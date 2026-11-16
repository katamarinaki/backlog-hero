use crate::store::{Result, Store};
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_updater::{Update, UpdaterExt};
use tokio::sync::Mutex;

#[derive(Default)]
pub struct Updates {
    pub status: std::sync::Mutex<Value>,
    pending: Mutex<Option<(Update, Vec<u8>)>>,
    checking: Mutex<()>,
}
fn status(app: &AppHandle, value: Value) {
    *app.state::<Updates>().status.lock().unwrap() = value.clone();
    let _ = app.emit("updater-status", value);
}
pub async fn check(app: AppHandle) {
    let updates = app.state::<Updates>();
    let Ok(_guard) = updates.checking.try_lock() else {
        return;
    };
    if cfg!(debug_assertions) {
        status(
            &app,
            json!({"type":"disabled","message":"Updates are available in installed release builds."}),
        );
        return;
    }
    let Some(key) = option_env!("TAURI_UPDATER_PUBLIC_KEY").filter(|s| !s.trim().is_empty()) else {
        status(
            &app,
            json!({"type":"disabled","message":"Automatic updates are not configured for this build. Download new versions from GitHub Releases."}),
        );
        return;
    };
    status(&app, json!({"type":"checking"}));
    let result: Result<()> = async {
        let beta = app.state::<Store>().snapshot()?["useBetaUpdates"] == true;
        let endpoint = if beta {"https://github.com/katamarinaki/backlog-hero/releases/download/beta/latest.json"}
            else {"https://github.com/katamarinaki/backlog-hero/releases/latest/download/latest.json"};
        let updater = app.updater_builder().pubkey(key).endpoints(vec![endpoint.parse().map_err(|_| "Invalid update endpoint")?]).map_err(|e| e.to_string())?
            .build().map_err(|e| e.to_string())?;
        if let Some(update) = updater.check().await.map_err(|e| e.to_string())? {
            status(&app, json!({"type":"available","version":update.version}));
            let mut downloaded = 0_u64;
            let bytes = update.download(|chunk, total| {
                downloaded += chunk as u64;
                status(&app, json!({"type":"downloading","percent":total.filter(|n| *n > 0).map(|n| downloaded*100/n).unwrap_or(0)}));
            }, || {}).await.map_err(|e| e.to_string())?;
            let version = update.version.clone();
            *updates.pending.lock().await = Some((update, bytes));
            status(&app, json!({"type":"downloaded","version":version}));
        } else {
            status(&app, json!({"type":"not-available","version":app.package_info().version.to_string()}));
        }
        Ok(())
    }.await;
    if let Err(error) = result {
        status(&app, json!({"type":"error","message":error}));
    }
}
pub async fn install(app: AppHandle) -> Result<Value> {
    let updates = app.state::<Updates>();
    let mut pending = updates.pending.lock().await;
    let (update, bytes) = pending
        .as_ref()
        .ok_or("No downloaded update is available")?;
    update.install(bytes).map_err(|e| e.to_string())?;
    *pending = None;
    app.restart();
}
pub async fn change_channel(app: AppHandle) {
    // Wait for an old-channel check, then discard its download before checking
    // the new channel. Installation never crosses channel boundaries.
    let updates = app.state::<Updates>();
    let guard = updates.checking.lock().await;
    *updates.pending.lock().await = None;
    drop(guard);
    check(app).await;
}
