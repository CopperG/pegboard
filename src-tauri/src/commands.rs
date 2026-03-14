use std::sync::Arc;
use tauri::State;

use crate::ws_server::WsState;
use crate::{CanvasState, PanelsDataCache};

#[tauri::command]
pub fn send_ws_message(message: String, ws_state: State<'_, Arc<WsState>>) -> Result<(), String> {
    ws_state
        .tx
        .send(message)
        .map_err(|e| format!("Failed to send WS message: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn get_ws_status(ws_state: State<'_, Arc<WsState>>) -> Result<String, String> {
    let count = ws_state.tx.receiver_count();
    let last_at = *ws_state.last_connected_at.read().await;
    let total = ws_state.total_connections.load(std::sync::atomic::Ordering::Relaxed);

    if count > 0 {
        Ok(format!("connected ({})", count))
    } else if let Some(ts) = last_at {
        // No active clients but had connections before — recently active
        Ok(format!("idle (last_seen:{}, total:{})", ts, total))
    } else {
        Ok("no_clients".to_string())
    }
}

/// Sync canvas state from frontend into the in-memory cache.
/// Called by the frontend whenever canvas state changes,
/// so WS clients can query it via get_canvas_state.
#[tauri::command]
pub async fn sync_canvas_state(json: String, state: State<'_, CanvasState>) -> Result<(), String> {
    // Size limit: 50MB max to prevent DoS
    const MAX_SIZE: usize = 50 * 1024 * 1024;
    if json.len() > MAX_SIZE {
        return Err(format!("Canvas state too large: {} bytes (max {} bytes)", json.len(), MAX_SIZE));
    }
    // Validate JSON
    serde_json::from_str::<serde_json::Value>(&json)
        .map_err(|e| format!("Invalid JSON: {}", e))?;
    *state.0.write().await = json;
    Ok(())
}

/// Sync full panel data (panelId -> full panel object) into the in-memory cache.
/// Called alongside sync_canvas_state so WS clients can query individual panels.
#[tauri::command]
pub async fn sync_panels_data(json: String, state: State<'_, PanelsDataCache>) -> Result<(), String> {
    // Size limit: 50MB max to prevent DoS
    const MAX_SIZE: usize = 50 * 1024 * 1024;
    if json.len() > MAX_SIZE {
        return Err(format!("Panels data too large: {} bytes (max {} bytes)", json.len(), MAX_SIZE));
    }
    // Validate JSON
    serde_json::from_str::<serde_json::Value>(&json)
        .map_err(|e| format!("Invalid JSON: {}", e))?;
    *state.0.write().await = json;
    Ok(())
}

/// Save canvas state to disk for persistence across restarts.
#[tauri::command]
pub async fn save_canvas_state(json: String) -> Result<(), String> {
    crate::fs_ops::save_canvas_state(&json).await
}

/// Load canvas state from disk on startup.
#[tauri::command]
pub async fn load_canvas_state() -> Result<Option<String>, String> {
    crate::fs_ops::load_canvas_state().await
}

#[tauri::command]
pub async fn save_archived_panel(json: String, panel_id: String) -> Result<(), String> {
    crate::fs_ops::save_archived_panel(&json, &panel_id).await
}

#[tauri::command]
pub async fn delete_archived_panel(panel_id: String) -> Result<(), String> {
    crate::fs_ops::delete_archived_panel(&panel_id).await
}

#[tauri::command]
pub async fn create_daily_snapshot(json: String) -> Result<(), String> {
    crate::fs_ops::create_daily_snapshot(&json).await
}

#[tauri::command]
pub async fn snapshot_exists_today() -> Result<bool, String> {
    Ok(crate::fs_ops::snapshot_exists_today().await)
}

#[tauri::command]
pub async fn cleanup_old_snapshots(keep_days: u32) -> Result<(), String> {
    crate::fs_ops::cleanup_old_snapshots(keep_days).await
}

#[tauri::command]
pub async fn ensure_data_dirs() -> Result<(), String> {
    crate::fs_ops::ensure_dirs().await
}

#[tauri::command]
pub async fn save_upload(name: String, data: Vec<u8>) -> Result<String, String> {
    crate::fs_ops::save_upload(&name, &data).await
}

#[tauri::command]
pub async fn cleanup_uploads(max_age_days: u64) -> Result<u32, String> {
    crate::fs_ops::cleanup_uploads(max_age_days).await
}

#[tauri::command]
pub async fn get_uploads_dir() -> Result<String, String> {
    Ok(crate::fs_ops::get_data_dir().join("uploads").to_string_lossy().to_string())
}

// ── File Read Command (for realtime file-watch adapter) ─────────────

#[tauri::command]
pub async fn read_file_content(path: String) -> Result<String, String> {
    // Security: resolve the canonical path and reject anything containing
    // obvious path traversal components or sensitive system paths.
    let canonical = std::fs::canonicalize(&path)
        .map_err(|e| format!("Invalid path: {}", e))?;
    let path_str = canonical.to_string_lossy();

    // Check that the file is not a symlink to a blocked path
    // (canonicalize already resolves symlinks, so we check the resolved path)

    // Block reads of well-known sensitive files / directories
    let blocked = [
        "/etc/", ".ssh/", ".gnupg/", ".aws/", ".env",
        ".git/config", ".docker/", ".kube/",
        "/proc/", "/sys/", "/dev/",
        "shadow", "passwd", ".credentials",
        "id_rsa", "id_ed25519", ".pem", ".key", "secrets",
    ];
    for pattern in &blocked {
        if path_str.contains(pattern) {
            return Err(format!("Access denied: {}", path));
        }
    }

    // Check file size before reading (10MB limit)
    let metadata = tokio::fs::metadata(&canonical)
        .await
        .map_err(|e| format!("Failed to read file metadata: {}", e))?;
    const MAX_FILE_SIZE: u64 = 10 * 1024 * 1024; // 10MB
    if metadata.len() > MAX_FILE_SIZE {
        return Err(format!(
            "File too large: {} bytes (max {} bytes)",
            metadata.len(),
            MAX_FILE_SIZE
        ));
    }

    tokio::fs::read_to_string(&canonical)
        .await
        .map_err(|e| format!("Failed to read file: {}", e))
}

// ── Template Management Commands ─────────────────────────────────────

#[tauri::command]
pub async fn scan_templates() -> Result<String, String> {
    crate::fs_ops::scan_templates().await
}

#[tauri::command]
pub async fn get_template(name: String) -> Result<String, String> {
    crate::fs_ops::get_template(&name).await
}

#[tauri::command]
pub async fn delete_template(name: String) -> Result<(), String> {
    crate::fs_ops::delete_template(&name).await
}

#[tauri::command]
pub async fn import_template(path: String) -> Result<(), String> {
    crate::fs_ops::import_template(&path).await
}
