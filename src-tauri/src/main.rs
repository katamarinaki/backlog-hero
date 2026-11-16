#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod steam;
mod store;
mod updater;

use serde_json::{json, Value};
use store::{Result, Store};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_dialog::{DialogExt, MessageDialogKind};

fn now() -> i64 {
    chrono::Utc::now().timestamp_millis()
}
fn appid(payload: &Value) -> Result<u64> {
    payload["appid"]
        .as_u64()
        .filter(|id| *id > 0)
        .ok_or("Invalid game ID".into())
}
fn credentials(data: &Value) -> Result<(&str, &str)> {
    let key = data["apiKey"].as_str().unwrap_or("");
    let id = data["steamId"].as_str().unwrap_or("");
    if key.is_empty() || id.is_empty() {
        Err("API key and Steam ID are required".into())
    } else {
        Ok((key, id))
    }
}

#[tauri::command]
async fn request(app: AppHandle, operation: String, payload: Value) -> Result<Value> {
    let store = app.state::<Store>();
    let steam = app.state::<steam::Steam>();
    // No store mutex is held over network requests or native dialogs.
    let data = store.snapshot()?;
    let getter = match operation.as_str() {
        "get-games" => Some("games"),
        "get-ratings" => Some("ratings"),
        "get-notes" => Some("notes"),
        "get-user-ratings" => Some("userRatings"),
        "get-completions" => Some("completions"),
        "get-sessions" => Some("sessions"),
        "get-statuses" => Some("statuses"),
        "get-achievements" => Some("achievements"),
        "get-filter-preferences" => Some("filterPreferences"),
        "get-beta-updates" => Some("useBetaUpdates"),
        "get-last-fetch-timestamp" => Some("lastFetchTimestamp"),
        _ => None,
    };
    if let Some(key) = getter {
        return Ok(data[key].clone());
    }
    match operation.as_str() {
        "get-settings" => Ok(json!({"apiKey":data["apiKey"],"steamId":data["steamId"]})),
        "save-settings" => {
            let key = payload["apiKey"].as_str().unwrap_or("").trim();
            let id = payload["steamId"].as_str().unwrap_or("").trim();
            if key.is_empty() || id.is_empty() {
                return Err("API key and Steam ID must not be empty".into());
            }
            store.edit(|d| {
                d["apiKey"] = json!(key);
                d["steamId"] = json!(id);
                Ok(json!(true))
            })
        }
        "get-app-version" => Ok(json!(app.package_info().version.to_string())),
        "get-is-packaged" => Ok(json!(!cfg!(debug_assertions))),
        "get-updater-status" => Ok(app
            .state::<updater::Updates>()
            .status
            .lock()
            .map_err(|e| e.to_string())?
            .clone()),
        "install-update" => updater::install(app.clone()).await,
        "save-beta-updates" => {
            if !payload.is_boolean() {
                return Err("Expected a boolean".into());
            }
            store.edit(|d| {
                d["useBetaUpdates"] = payload;
                Ok(())
            })?;
            tauri::async_runtime::spawn(updater::change_channel(app.clone()));
            Ok(json!(true))
        }
        "fetch-games" => {
            let (key, id) = credentials(&data)?;
            let games = steam.games(key, id).await?;
            store.edit(|d| {
                d["games"] = games.clone();
                d["lastFetchTimestamp"] = json!(now());
                Ok(games)
            })
        }
        "resolve-covers" => {
            let ids: Vec<u64> = serde_json::from_value(payload).map_err(|_| "Invalid game IDs")?;
            let missing = ids
                .into_iter()
                .filter(|id| data["coverUrls"].get(id.to_string()).is_none())
                .collect::<Vec<_>>();
            if missing.is_empty() {
                return Ok(data["coverUrls"].clone());
            }
            let covers = steam.covers(&missing).await;
            store.edit(|d| {
                d["coverUrls"]
                    .as_object_mut()
                    .unwrap()
                    .extend(covers.as_object().unwrap().clone());
                Ok(d["coverUrls"].clone())
            })
        }
        "fetch-ratings" | "fetch-achievements" | "fetch-rating" | "fetch-achievement" => {
            let achievements = operation.contains("achievement");
            let batch = operation.ends_with('s');
            let (cache, timestamps, event) = if achievements {
                (
                    "achievements",
                    "achievementTimestamps",
                    "fetch-achievements-progress",
                )
            } else {
                ("ratings", "ratingTimestamps", "fetch-ratings-progress")
            };
            let (key, id) = if achievements {
                credentials(&data)?
            } else {
                ("", "")
            };
            let ids: Vec<u64> = if batch {
                serde_json::from_value(payload).map_err(|_| "Invalid game IDs")?
            } else {
                vec![payload
                    .as_u64()
                    .filter(|id| *id > 0)
                    .ok_or("Invalid game ID")?]
            };
            let missing: Vec<_> = ids
                .iter()
                .copied()
                .filter(|id| data[cache].get(id.to_string()).is_none())
                .collect();
            let mut fetched = 0;
            for chunk in missing.chunks(5) {
                let results = futures::future::join_all(chunk.iter().map(|appid| async {
                    let result = if achievements {
                        steam.achievements(*appid, key, id).await
                    } else {
                        steam.rating(*appid).await
                    };
                    (*appid, result)
                }))
                .await;
                store.edit(|d| {
                    for (appid, value) in results {
                        if let Some(value) = value {
                            d[cache][appid.to_string()] = value;
                            d[timestamps][appid.to_string()] = json!(now());
                        }
                        fetched += 1;
                        if batch {
                            let _ =
                                app.emit(event, json!({"fetched":fetched,"total":missing.len()}));
                        }
                    }
                    Ok(())
                })?;
                if fetched < missing.len() {
                    tokio::time::sleep(std::time::Duration::from_millis(200)).await;
                }
            }
            let current = store.snapshot()?;
            Ok(if batch {
                current[cache].clone()
            } else {
                current[cache][ids[0].to_string()].clone()
            })
        }
        "get-rating-timestamp" | "get-achievement-timestamp" => {
            let id = payload.as_u64().ok_or("Invalid game ID")?.to_string();
            Ok(data[if operation == "get-rating-timestamp" {
                "ratingTimestamps"
            } else {
                "achievementTimestamps"
            }][id]
                .clone())
        }
        "save-filter-preferences" => {
            if !store::valid_preferences(&payload) {
                return Err("Invalid filter preferences".into());
            }
            store.edit(|d| {
                d["filterPreferences"] = payload;
                Ok(json!(true))
            })
        }
        "save-note" | "save-user-rating" | "save-completion" | "save-status" => {
            let id = appid(&payload)?.to_string();
            let (map, field) = match operation.as_str() {
                "save-note" => ("notes", "note"),
                "save-user-rating" => ("userRatings", "rating"),
                "save-completion" => ("completions", "completion"),
                _ => ("statuses", "status"),
            };
            let value = payload.get(field).ok_or("Missing value")?.clone();
            let valid = match field {
                "note" => value.is_string(),
                "rating" => store::valid_rating(&value),
                "completion" => value.is_null() || value["completed"].is_boolean(),
                _ => value.is_null() || store::valid_status(&value),
            };
            if !valid {
                return Err(format!("Invalid {field}"));
            }
            store.edit(|d| {
                if value.is_null() {
                    d[map].as_object_mut().unwrap().remove(&id);
                } else {
                    d[map][id] = value;
                }
                Ok(json!(true))
            })
        }
        "save-session" | "delete-session" => {
            let id = appid(&payload)?;
            let session = &payload["session"];
            let session_id = if operation == "save-session" {
                if !store::valid_session(session, id) {
                    return Err("Invalid session".into());
                }
                session["id"].as_str().unwrap()
            } else {
                payload["id"].as_str().ok_or("Invalid session ID")?
            };
            store.edit(|d| {
                let mut list = d["sessions"][id.to_string()]
                    .as_array()
                    .cloned()
                    .unwrap_or_default();
                if operation == "save-session" {
                    if let Some(index) = list.iter().position(|s| s["id"] == session_id) {
                        list[index] = session.clone();
                    } else {
                        list.push(session.clone());
                    }
                } else {
                    list.retain(|s| s["id"] != session_id);
                }
                if list.is_empty() {
                    d["sessions"]
                        .as_object_mut()
                        .unwrap()
                        .remove(&id.to_string());
                } else {
                    d["sessions"][id.to_string()] = json!(list);
                }
                Ok(json!(list))
            })
        }
        "export-data" => {
            let dialog_app = app.clone();
            let path = tauri::async_runtime::spawn_blocking(move || {
                dialog_app
                    .dialog()
                    .file()
                    .add_filter("JSON", &["json"])
                    .set_file_name("backlog-hero-backup.json")
                    .blocking_save_file()
            })
            .await
            .map_err(|e| e.to_string())?;
            if let Some(path) = path {
                let path = path.into_path().map_err(|e| e.to_string())?;
                // Serialize exports and imports with mutations to avoid losing writes.
                let snapshot = store.snapshot()?;
                store::atomic_write(&path, &snapshot)?;
                Ok(json!(true))
            } else {
                Ok(json!(false))
            }
        }
        "import-data" => {
            let dialog_app = app.clone();
            let path = tauri::async_runtime::spawn_blocking(move || {
                dialog_app
                    .dialog()
                    .file()
                    .add_filter("JSON", &["json"])
                    .blocking_pick_file()
            })
            .await
            .map_err(|e| e.to_string())?;
            if let Some(path) = path {
                let raw = std::fs::read_to_string(path.into_path().map_err(|e| e.to_string())?)
                    .map_err(|e| e.to_string())?;
                let imported =
                    store::normalize(serde_json::from_str(&raw).map_err(|e| e.to_string())?)?;
                store.edit(|d| {
                    *d = imported;
                    Ok(json!(true))
                })
            } else {
                Ok(json!(false))
            }
        }
        _ => Err("Unknown desktop operation".into()),
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_opener::Builder::new()
                .open_js_links_on_click(false)
                .build(),
        )
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let store = match Store::open(app.handle()) {
                Ok(store) => store,
                Err(error) => {
                    let window = app.get_webview_window("main").ok_or("Missing main window")?;
                    window.navigate("about:blank".parse()?)?;
                    let handle = app.handle().clone();
                    app.dialog()
                        .message(format!("Backlog Hero could not load its local data.\n\n{error}\n\nYour data file was not replaced. Restore a valid config.json from a backup and reopen the app."))
                        .parent(&window)
                        .title("Unable to start Backlog Hero")
                        .kind(MessageDialogKind::Error)
                        .show(move |_| handle.exit(1));
                    return Ok(());
                }
            };
            app.manage(store);
            app.manage(steam::Steam::new().map_err(std::io::Error::other)?);
            app.manage(updater::Updates::default());
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                loop {
                    updater::check(handle.clone()).await;
                    tokio::time::sleep(std::time::Duration::from_secs(4 * 60 * 60)).await;
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![request])
        .run(tauri::generate_context!())
        .expect("Unable to start Backlog Hero");
}
