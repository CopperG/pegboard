use std::path::PathBuf;
use std::time::{SystemTime, Duration};
use chrono::TimeZone;
use tokio::fs;

/// Validate that an ID is safe for use in file paths (alphanumeric, hyphens, underscores only)
fn validate_safe_id(id: &str) -> Result<(), String> {
    if id.is_empty() || id.len() > 128 {
        return Err("ID must be 1-128 characters".into());
    }
    if id.contains("..") || id.contains('/') || id.contains('\\') || id.contains('\0') {
        return Err("ID contains invalid characters".into());
    }
    // Only allow alphanumeric, hyphens, underscores, dots
    if !id.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_' || c == '.') {
        return Err("ID contains disallowed characters".into());
    }
    Ok(())
}

pub fn get_data_dir() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    PathBuf::from(home).join(".pegboard")
}

/// Ensure all subdirectories exist
pub async fn ensure_dirs() -> Result<(), String> {
    let base = get_data_dir();
    let dirs = [
        base.join("current"),
        base.join("archived").join("panels"),
        base.join("snapshots"),
        base.join("config"),
        base.join("uploads"),
        base.join("templates"),
    ];
    for dir in &dirs {
        fs::create_dir_all(dir)
            .await
            .map_err(|e| format!("Failed to create dir {:?}: {}", dir, e))?;
    }
    Ok(())
}

/// Ensure uploads directory exists
pub async fn ensure_uploads_dir() -> Result<(), String> {
    let dir = get_data_dir().join("uploads");
    fs::create_dir_all(&dir)
        .await
        .map_err(|e| format!("Failed to create uploads dir: {}", e))?;
    Ok(())
}

/// Save an uploaded file to ~/.pegboard/uploads/{timestamp_ms}-{name}
/// Returns the full path as a string.
pub async fn save_upload(name: &str, data: &[u8]) -> Result<String, String> {
    ensure_uploads_dir().await?;

    let timestamp = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();

    // Sanitize filename: remove path separators, traversal sequences, and control characters
    let safe_name: String = name
        .replace('/', "_")
        .replace('\\', "_")
        .replace('\0', "_")
        .replace("..", "_")
        .chars()
        .filter(|c| !c.is_control())
        .collect();

    // Limit filename length to 255 characters (leaving room for timestamp prefix)
    let safe_name = if safe_name.len() > 200 {
        safe_name[..200].to_string()
    } else {
        safe_name
    };

    let filename = format!("{}-{}", timestamp, safe_name);
    let path = get_data_dir().join("uploads").join(&filename);

    fs::write(&path, data)
        .await
        .map_err(|e| format!("Failed to write upload file: {}", e))?;

    Ok(path.to_string_lossy().to_string())
}

/// Delete files in uploads/ older than max_age_days.
/// Returns the count of deleted files.
pub async fn cleanup_uploads(max_age_days: u64) -> Result<u32, String> {
    let dir = get_data_dir().join("uploads");
    let mut entries = match fs::read_dir(&dir).await {
        Ok(e) => e,
        Err(_) => return Ok(0), // Dir doesn't exist, nothing to clean
    };

    let cutoff = SystemTime::now() - Duration::from_secs(max_age_days * 24 * 60 * 60);
    let mut deleted = 0u32;

    while let Ok(Some(entry)) = entries.next_entry().await {
        // Skip symlinks to prevent following links to unintended locations
        if entry.file_type().await.map(|ft| ft.is_symlink()).unwrap_or(false) {
            continue;
        }
        if let Ok(metadata) = entry.metadata().await {
            let modified = metadata.modified().unwrap_or(SystemTime::now());
            if modified < cutoff {
                if fs::remove_file(entry.path()).await.is_ok() {
                    deleted += 1;
                }
            }
        }
    }

    Ok(deleted)
}

/// Atomic write: write to .tmp then rename
pub async fn save_canvas_state(state_json: &str) -> Result<(), String> {
    let base = get_data_dir().join("current");
    let target = base.join("canvas-state.json");
    let tmp = base.join("canvas-state.json.tmp");

    fs::write(&tmp, state_json)
        .await
        .map_err(|e| format!("Failed to write tmp file: {}", e))?;
    fs::rename(&tmp, &target)
        .await
        .map_err(|e| format!("Failed to rename tmp to target: {}", e))?;
    Ok(())
}

pub async fn load_canvas_state() -> Result<Option<String>, String> {
    let path = get_data_dir().join("current").join("canvas-state.json");
    match fs::read_to_string(&path).await {
        Ok(content) => Ok(Some(content)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(format!("Failed to read canvas state: {}", e)),
    }
}

pub async fn save_archived_panel(panel_json: &str, panel_id: &str) -> Result<(), String> {
    validate_safe_id(panel_id)?;
    let path = get_data_dir()
        .join("archived")
        .join("panels")
        .join(format!("{}.json", panel_id));
    fs::write(&path, panel_json)
        .await
        .map_err(|e| format!("Failed to save archived panel: {}", e))?;
    Ok(())
}

pub async fn delete_archived_panel(panel_id: &str) -> Result<(), String> {
    validate_safe_id(panel_id)?;
    let path = get_data_dir()
        .join("archived")
        .join("panels")
        .join(format!("{}.json", panel_id));
    match fs::remove_file(&path).await {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(format!("Failed to delete archived panel: {}", e)),
    }
}

pub async fn create_daily_snapshot(json: &str) -> Result<(), String> {
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let path = get_data_dir()
        .join("snapshots")
        .join(format!("{}.json", today));
    fs::write(&path, json)
        .await
        .map_err(|e| format!("Failed to create snapshot: {}", e))?;
    Ok(())
}

pub async fn snapshot_exists_today() -> bool {
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let path = get_data_dir()
        .join("snapshots")
        .join(format!("{}.json", today));
    path.exists()
}

pub async fn cleanup_old_snapshots(keep_days: u32) -> Result<(), String> {
    let dir = get_data_dir().join("snapshots");
    let mut entries = match fs::read_dir(&dir).await {
        Ok(e) => e,
        Err(_) => return Ok(()), // Dir doesn't exist, nothing to clean
    };

    let cutoff = chrono::Local::now() - chrono::Duration::days(keep_days as i64);

    while let Ok(Some(entry)) = entries.next_entry().await {
        let name = entry.file_name().to_string_lossy().to_string();
        if let Some(date_str) = name.strip_suffix(".json") {
            if let Ok(date) = chrono::NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
                let Some(dt) = date.and_hms_opt(0, 0, 0) else { continue };
                let Some(local_dt) = chrono::Local.from_local_datetime(&dt).latest() else { continue };
                if local_dt < cutoff {
                    let _ = fs::remove_file(entry.path()).await;
                }
            }
        }
    }
    Ok(())
}

// ── Template Management ──────────────────────────────────────────────

/// Ensure templates directory exists
pub async fn ensure_templates_dir() -> Result<PathBuf, String> {
    let dir = get_data_dir().join("templates");
    fs::create_dir_all(&dir)
        .await
        .map_err(|e| format!("Failed to create templates dir: {}", e))?;
    Ok(dir)
}

/// Scan ~/.pegboard/templates/ for installed templates.
/// Each subdirectory should contain a meta.json.
/// Returns a JSON array of template metadata objects.
pub async fn scan_templates() -> Result<String, String> {
    let dir = ensure_templates_dir().await?;
    let mut entries = match fs::read_dir(&dir).await {
        Ok(e) => e,
        Err(_) => return Ok("[]".to_string()),
    };

    let mut templates: Vec<serde_json::Value> = Vec::new();

    while let Ok(Some(entry)) = entries.next_entry().await {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let meta_path = path.join("meta.json");
        if let Ok(content) = fs::read_to_string(&meta_path).await {
            if let Ok(meta) = serde_json::from_str::<serde_json::Value>(&content) {
                templates.push(meta);
            }
        }
    }

    serde_json::to_string(&templates)
        .map_err(|e| format!("Failed to serialize templates: {}", e))
}

/// Read template.html + style.css from a template directory.
/// Returns JSON { html: "...", css: "..." }.
pub async fn get_template(name: &str) -> Result<String, String> {
    let dir = get_data_dir().join("templates").join(name);
    if !dir.exists() {
        return Err(format!("Template '{}' not found", name));
    }

    let html = fs::read_to_string(dir.join("template.html"))
        .await
        .unwrap_or_default();
    let css = fs::read_to_string(dir.join("style.css"))
        .await
        .unwrap_or_default();

    let result = serde_json::json!({
        "html": html,
        "css": css,
    });

    Ok(result.to_string())
}

/// Delete a template directory.
pub async fn delete_template(name: &str) -> Result<(), String> {
    let dir = get_data_dir().join("templates").join(name);
    if !dir.exists() {
        return Ok(()); // Already gone
    }
    fs::remove_dir_all(&dir)
        .await
        .map_err(|e| format!("Failed to delete template '{}': {}", name, e))
}

/// Import a template from a source directory.
/// The source must contain at least a meta.json file.
/// Copies the directory contents into ~/.pegboard/templates/{name}/.
pub async fn import_template(path: &str) -> Result<(), String> {
    let src = PathBuf::from(path);
    if !src.is_dir() {
        return Err(format!("'{}' is not a directory", path));
    }

    // Canonicalize source path and verify it doesn't point to sensitive locations
    let canonical_src = std::fs::canonicalize(&src)
        .map_err(|e| format!("Invalid source path: {}", e))?;
    let src_str = canonical_src.to_string_lossy();
    let sensitive_paths = ["/etc", "/usr", "/bin", "/sbin", "/var", "/System", "/Library"];
    for sensitive in &sensitive_paths {
        if src_str.starts_with(sensitive) {
            return Err(format!("Access denied: cannot import from {}", sensitive));
        }
    }

    // Read meta.json to get template name
    let meta_path = canonical_src.join("meta.json");
    let meta_content = fs::read_to_string(&meta_path)
        .await
        .map_err(|_| "meta.json not found in template directory".to_string())?;

    let meta: serde_json::Value = serde_json::from_str(&meta_content)
        .map_err(|e| format!("Invalid meta.json: {}", e))?;

    let name = meta
        .get("name")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "meta.json must contain a 'name' field".to_string())?;

    // Validate template name for safe use in file paths
    validate_safe_id(name)?;

    let dest = ensure_templates_dir().await?.join(name);
    fs::create_dir_all(&dest)
        .await
        .map_err(|e| format!("Failed to create template dir: {}", e))?;

    // Copy all files from source to destination
    let mut entries = fs::read_dir(&canonical_src)
        .await
        .map_err(|e| format!("Failed to read source dir: {}", e))?;

    while let Ok(Some(entry)) = entries.next_entry().await {
        let entry_path = entry.path();
        // Skip symlinks
        if entry.file_type().await.map(|ft| ft.is_symlink()).unwrap_or(false) {
            continue;
        }
        if entry_path.is_file() {
            let file_name = entry.file_name();
            let dest_file = dest.join(&file_name);
            fs::copy(&entry_path, &dest_file)
                .await
                .map_err(|e| format!("Failed to copy {:?}: {}", file_name, e))?;
        }
    }

    Ok(())
}
