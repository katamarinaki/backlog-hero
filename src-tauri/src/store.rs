use serde_json::{json, Value};
use std::{
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
};
use tauri::{AppHandle, Manager};

pub type Result<T> = std::result::Result<T, String>;
pub struct Store {
    pub path: PathBuf,
    pub data: Mutex<Value>,
}

pub fn defaults() -> Value {
    json!({"apiKey":"", "steamId":"", "games":[], "ratings":{}, "ratingTimestamps":{},
        "userRatings":{}, "notes":{}, "completions":{}, "statuses":{}, "achievements":{},
        "achievementTimestamps":{}, "coverUrls":{}, "sessions":{},
        "filterPreferences":{"statusFilter":"all", "sortBy":"playtime", "sortAsc":false},
        "useBetaUpdates":false, "lastFetchTimestamp":0})
}

pub fn valid_game(v: &Value) -> bool {
    v["appid"].as_u64().is_some() && v["name"].is_string() && v["playtime_forever"].is_number()
}
pub fn valid_rating(v: &Value) -> bool {
    v.as_u64().is_some_and(|r| r <= 100)
}
pub fn valid_session(v: &Value, id: u64) -> bool {
    v["appid"].as_u64() == Some(id)
        && v["id"].as_str().is_some_and(|s| !s.is_empty())
        && v["minutes"].as_f64().is_some_and(|n| n >= 0.0)
        && v["date"]
            .as_str()
            .is_some_and(|s| chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").is_ok())
        && v.get("rating").is_none_or(valid_rating)
        && v.get("notes").is_none_or(Value::is_string)
}
pub fn valid_status(v: &Value) -> bool {
    v.is_object()
        && v.get("status").is_none_or(|s| {
            s.as_str()
                .is_some_and(|s| ["backlog", "completed", "retired", "dropped"].contains(&s))
        })
        && ["statusDate", "completedDate"]
            .iter()
            .all(|k| v.get(k).is_none_or(Value::is_string))
}
pub fn valid_preferences(v: &Value) -> bool {
    v["statusFilter"].as_str().is_some_and(|s| {
        [
            "all",
            "backlog",
            "completed",
            "retired",
            "dropped",
            "in_progress",
            "untracked",
        ]
        .contains(&s)
    }) && v["sortBy"]
        .as_str()
        .is_some_and(|s| ["playtime", "name", "rating", "last_played", "status_date"].contains(&s))
        && v["sortAsc"].is_boolean()
}

// Preserve the Electron JSON layout so existing exports can be restored directly.
pub fn normalize(raw: Value) -> Result<Value> {
    if !raw.is_object() {
        return Err("Invalid backup: expected an object".into());
    }
    let mut data = defaults();
    for (key, default) in data.as_object_mut().unwrap() {
        if let Some(value) = raw.get(key) {
            *default = value.clone();
        }
    }
    for key in ["apiKey", "steamId"] {
        if !data[key].is_string() {
            return Err(format!("Invalid {key}"));
        }
    }
    if !data["games"].is_array()
        || !data["useBetaUpdates"].is_boolean()
        || !data["lastFetchTimestamp"].is_number()
    {
        return Err("Invalid backup settings".into());
    }
    for game in data["games"].as_array().unwrap() {
        if !valid_game(game) {
            return Err("Invalid game in backup".into());
        }
    }
    for key in [
        "ratings",
        "ratingTimestamps",
        "userRatings",
        "notes",
        "completions",
        "statuses",
        "achievements",
        "achievementTimestamps",
        "coverUrls",
        "sessions",
    ] {
        if !data[key].is_object() {
            return Err(format!("Invalid {key}"));
        }
        for (id, value) in data[key].as_object().unwrap() {
            let appid = id
                .parse::<u64>()
                .map_err(|_| format!("Invalid game ID in {key}"))?;
            let valid = match key {
                "notes" | "coverUrls" => value.is_string(),
                "userRatings" => valid_rating(value),
                "ratingTimestamps" | "achievementTimestamps" => value.is_number(),
                "sessions" => value
                    .as_array()
                    .is_some_and(|a| a.iter().all(|s| valid_session(s, appid))),
                "achievements" => value["achieved"].is_u64() && value["total"].is_u64(),
                "ratings" => {
                    ["positive", "negative", "score", "total"]
                        .iter()
                        .all(|k| value[k].is_number())
                        && value["description"].is_string()
                }
                "completions" => {
                    value["completed"].is_boolean()
                        && value.get("completedDate").is_none_or(Value::is_string)
                }
                "statuses" => value.is_object(), // Legacy statuses are cleaned below.
                _ => false,
            };
            if !valid {
                return Err(format!("Invalid entry in {key}"));
            }
        }
    }
    if data["statuses"].as_object().unwrap().is_empty() {
        let completions = data["completions"].as_object().unwrap().clone();
        for (id, completion) in completions {
            if completion["completed"] == true {
                let date = completion["completedDate"]
                    .as_str()
                    .map(str::to_owned)
                    .unwrap_or_else(|| chrono::Utc::now().to_rfc3339());
                let mut status = json!({"status":"completed", "statusDate":date});
                if let Some(date) = completion.get("completedDate") {
                    status["completedDate"] = date.clone();
                }
                data["statuses"][id] = status;
            }
        }
    }
    let statuses = data["statuses"].as_object_mut().unwrap();
    statuses.retain(|_, value| {
        let obj = value.as_object_mut().unwrap();
        obj.remove("isEndless");
        if obj.get("status").and_then(Value::as_str) == Some("in_progress") {
            obj.remove("status");
        }
        !obj.is_empty()
    });
    if !statuses.values().all(valid_status) {
        return Err("Invalid status".into());
    }
    if data["filterPreferences"]["statusFilter"] == "endless" {
        data["filterPreferences"]["statusFilter"] = json!("all");
    }
    if !valid_preferences(&data["filterPreferences"]) {
        return Err("Invalid filter preferences".into());
    }
    Ok(data)
}

pub fn atomic_write(path: &Path, data: &Value) -> Result<()> {
    let parent = path.parent().ok_or("Invalid data path")?;
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    let temp = path.with_extension("json.tmp");
    let bytes = serde_json::to_vec_pretty(data).map_err(|e| e.to_string())?;
    {
        use std::io::Write;
        let mut file = fs::OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(true)
            .open(&temp)
            .map_err(|e| e.to_string())?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            file.set_permissions(fs::Permissions::from_mode(0o600))
                .map_err(|e| e.to_string())?;
        }
        file.write_all(&bytes).map_err(|e| e.to_string())?;
        file.sync_all().map_err(|e| e.to_string())?;
    }
    fs::rename(temp, path).map_err(|e| e.to_string())
}

impl Store {
    pub fn open(app: &AppHandle) -> Result<Self> {
        let path = app
            .path()
            .app_config_dir()
            .map_err(|e| e.to_string())?
            .join("config.json");
        let previous = app
            .path()
            .config_dir()
            .map_err(|e| e.to_string())?
            .join("com.steamtracker.app")
            .join("config.json");
        let candidates = if previous.exists() {
            vec![previous]
        } else {
            legacy_paths(app)?
        };
        Self::load(path, &candidates)
    }
    fn load(path: PathBuf, legacy: &[PathBuf]) -> Result<Self> {
        // Never overwrite or delete the old Electron file. A malformed file fails
        // startup rather than silently replacing the user's data with defaults.
        let source = if path.exists() {
            Some(path.clone())
        } else {
            legacy
                .iter()
                .filter(|p| p.is_file())
                .map(|p| {
                    fs::metadata(p)
                        .and_then(|m| m.modified())
                        .map(|time| (time, p))
                })
                .collect::<std::io::Result<Vec<_>>>()
                .map_err(|e| e.to_string())?
                .into_iter()
                .max_by_key(|(time, _)| *time)
                .map(|(_, p)| p.clone())
        };
        let data = match source {
            Some(source) => normalize(
                serde_json::from_str(&fs::read_to_string(source).map_err(|e| e.to_string())?)
                    .map_err(|e| e.to_string())?,
            )?,
            None => defaults(),
        };
        atomic_write(&path, &data)?;
        Ok(Self {
            path,
            data: Mutex::new(data),
        })
    }
    pub fn snapshot(&self) -> Result<Value> {
        Ok(self.data.lock().map_err(|e| e.to_string())?.clone())
    }
    pub fn edit<T>(&self, f: impl FnOnce(&mut Value) -> Result<T>) -> Result<T> {
        let mut guard = self.data.lock().map_err(|e| e.to_string())?;
        let mut next = guard.clone();
        let result = f(&mut next)?;
        atomic_write(&self.path, &next)?;
        *guard = next;
        Ok(result)
    }
}

fn legacy_paths(app: &AppHandle) -> Result<Vec<PathBuf>> {
    let base = app.path().config_dir().map_err(|e| e.to_string())?;
    let mut bases = vec![base];
    #[cfg(target_os = "macos")]
    bases.push(
        app.path()
            .home_dir()
            .map_err(|e| e.to_string())?
            .join("Library/Application Support"),
    );
    Ok(bases
        .into_iter()
        .flat_map(|base| {
            [
                "backlog-hero",
                "Backlog Hero",
                "steam-tracker",
                "Steam Tracker",
            ]
            .map(|name| base.join(name).join("config.json"))
        })
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn migrates_legacy_data_and_preserves_sessions_and_covers() {
        let input = json!({"completions":{"10":{"completed":true,"completedDate":"2026-01-01"}},
            "sessions":{"10":[{"id":"a","appid":10,"date":"2026-01-01","minutes":30}]},"coverUrls":{"10":"https://example.com/cover"}});
        let result = normalize(input).unwrap();
        assert_eq!(result["statuses"]["10"]["status"], "completed");
        assert_eq!(result["sessions"]["10"][0]["minutes"], 30);
        assert_eq!(normalize(result.clone()).unwrap(), result);
        assert_eq!(result["coverUrls"]["10"], "https://example.com/cover");
    }
    #[test]
    fn cleans_deprecated_statuses() {
        let result = normalize(json!({"statuses":{"1":{"status":"in_progress","isEndless":true},"2":{"status":"retired","isEndless":true}}})).unwrap();
        assert!(result["statuses"].get("1").is_none());
        assert_eq!(result["statuses"]["2"], json!({"status":"retired"}));
    }
    #[test]
    fn rejects_malformed_imports() {
        for value in [
            json!([]),
            json!({"sessions":{"1":[{"id":"a","appid":2,"minutes":-1}]}}),
            json!({"notes":{"1":42}}),
            json!({"userRatings":{"1":101}}),
        ] {
            assert!(normalize(value).is_err());
        }
    }
    #[test]
    fn copies_legacy_store_once_and_keeps_original() {
        let dir = std::env::temp_dir().join(format!("backlog-hero-test-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let legacy = dir.join("legacy.json");
        let path = dir.join("new/config.json");
        fs::write(&legacy, r#"{"notes":{"1":"keep me"}}"#).unwrap();
        let store = Store::load(path.clone(), std::slice::from_ref(&legacy)).unwrap();
        store
            .edit(|d| {
                d["notes"]["1"] = json!("updated");
                Ok(())
            })
            .unwrap();
        assert!(fs::read_to_string(&legacy).unwrap().contains("keep me"));
        assert_eq!(
            Store::load(path, &[legacy]).unwrap().snapshot().unwrap()["notes"]["1"],
            "updated"
        );
        fs::remove_dir_all(dir).unwrap();
    }
    #[test]
    fn failed_write_does_not_change_in_memory_data() {
        let dir =
            std::env::temp_dir().join(format!("backlog-hero-rollback-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let blocker = dir.join("file");
        fs::write(&blocker, "not a directory").unwrap();
        let store = Store {
            path: blocker.join("config.json"),
            data: Mutex::new(defaults()),
        };
        assert!(store
            .edit(|d| {
                d["notes"]["1"] = json!("must not persist");
                Ok(())
            })
            .is_err());
        assert_eq!(store.snapshot().unwrap()["notes"], json!({}));
        fs::remove_dir_all(dir).unwrap();
    }
    #[test]
    fn validates_session_dates_ratings_and_game_identity() {
        let valid = json!({"id":"s", "appid":10, "date":"2026-01-01", "minutes":0, "rating":100});
        assert!(valid_session(&valid, 10));
        assert!(!valid_session(&valid, 20));
        for (key, value) in [
            ("date", json!("2026-02-30")),
            ("minutes", json!(-1)),
            ("rating", json!(101)),
        ] {
            let mut invalid = valid.clone();
            invalid[key] = value;
            assert!(!valid_session(&invalid, 10));
        }
    }
}
