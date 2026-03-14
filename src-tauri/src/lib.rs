mod commands;
mod fs_ops;
mod ws_server;

use std::sync::Arc;
use tokio::sync::RwLock;
use ws_server::WsState;

/// Shared canvas state cached in memory (JSON string) — summaries for listPanels
pub struct CanvasState(pub Arc<RwLock<String>>);

/// Full panel data cached in memory (JSON map: panelId → panel object) — for getPanelDetail
pub struct PanelsDataCache(pub Arc<RwLock<String>>);

/// Shared WS authentication token
pub struct WsToken(pub Arc<RwLock<String>>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let ws_state = Arc::new(WsState::new());
    let canvas_state = Arc::new(RwLock::new("{}".to_string()));
    let panels_data = Arc::new(RwLock::new("{}".to_string()));
    let ws_token = Arc::new(RwLock::new(String::new()));

    tauri::Builder::default()
        .manage(ws_state.clone())
        .manage(CanvasState(canvas_state.clone()))
        .manage(PanelsDataCache(panels_data.clone()))
        .manage(WsToken(ws_token.clone()))
        .invoke_handler(tauri::generate_handler![
            commands::send_ws_message,
            commands::get_ws_status,
            commands::sync_canvas_state,
            commands::sync_panels_data,
            commands::save_canvas_state,
            commands::load_canvas_state,
            commands::save_archived_panel,
            commands::delete_archived_panel,
            commands::create_daily_snapshot,
            commands::snapshot_exists_today,
            commands::cleanup_old_snapshots,
            commands::ensure_data_dirs,
            commands::save_upload,
            commands::cleanup_uploads,
            commands::get_uploads_dir,
            commands::read_file_content,
            commands::scan_templates,
            commands::get_template,
            commands::delete_template,
            commands::import_template,
        ])
        .setup(move |app| {
            // Ensure data directories exist on startup
            tauri::async_runtime::spawn(async {
                if let Err(e) = fs_ops::ensure_dirs().await {
                    log::error!("Failed to ensure data dirs: {}", e);
                }
            });

            // Cleanup old uploads on startup (older than 7 days)
            tauri::async_runtime::spawn(async {
                if let Err(e) = fs_ops::cleanup_uploads(7).await {
                    log::error!("Failed to cleanup uploads: {}", e);
                }
            });

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Generate WS auth token and persist to disk
            {
                let token = uuid::Uuid::new_v4().to_string();
                let token_clone = token.clone();
                let ws_token_clone = ws_token.clone();
                tauri::async_runtime::spawn(async move {
                    *ws_token_clone.write().await = token_clone.clone();
                    // Write token to config file for external clients
                    let data_dir = fs_ops::get_data_dir();
                    let config_dir = data_dir.join("config");
                    let _ = tokio::fs::create_dir_all(&config_dir).await;
                    let token_file = config_dir.join("ws-token.json");
                    let json = format!(r#"{{"token":"{}","port":9800}}"#, token_clone);
                    let _ = tokio::fs::write(&token_file, json).await;
                    // Set file permissions to owner-only read/write
                    #[cfg(unix)]
                    {
                        use std::os::unix::fs::PermissionsExt;
                        let perms = std::fs::Permissions::from_mode(0o600);
                        let _ = std::fs::set_permissions(&token_file, perms);
                    }
                    log::info!("WS token written to {:?}", config_dir.join("ws-token.json"));
                });
            }

            // Start WebSocket server with token and canvas state
            let app_handle = app.handle().clone();
            let state = ws_state.clone();
            let cs = canvas_state.clone();
            let pd = panels_data.clone();
            let tk = ws_token.clone();
            tauri::async_runtime::spawn(async move {
                ws_server::start_ws_server(app_handle, state, cs, pd, tk).await;
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
