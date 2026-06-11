// Manages the claude-bridge node child process, started/stopped from the UI.
//
// App-managed lifecycle: the child is killed when the app exits (see the
// RunEvent::Exit handler in lib.rs), so a toggled-on bridge never orphans into
// a second consumer of the chat WebSocket (which would cause double replies).

use std::path::PathBuf;
use std::process::{Child, Command};
use std::sync::Mutex;

/// Holds the spawned claude-bridge child process, if one is running.
pub struct BridgeState(pub Mutex<Option<Child>>);

impl BridgeState {
    pub fn new() -> Self {
        Self(Mutex::new(None))
    }
}

/// Absolute path to the claude-bridge entry script, derived from the compile-time
/// repo layout (src-tauri/.. = repo root). Fine for dev / personal use; a bundled
/// app would instead ship the script as a Tauri resource and resolve it at runtime.
fn bridge_script() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .map(|p| p.to_path_buf())
        .unwrap_or_default()
        .join("claude-bridge")
        .join("index.mjs")
}

/// Locate the `node` binary. GUI apps don't inherit the shell PATH, so check the
/// usual install locations first, then fall back to a login shell `command -v`.
fn resolve_node() -> Option<PathBuf> {
    for c in ["/opt/homebrew/bin/node", "/usr/local/bin/node", "/usr/bin/node"] {
        let p = PathBuf::from(c);
        if p.exists() {
            return Some(p);
        }
    }
    let out = Command::new("/bin/sh")
        .args(["-lc", "command -v node"])
        .output()
        .ok()?;
    if out.status.success() {
        let path = String::from_utf8_lossy(&out.stdout).trim().to_string();
        if !path.is_empty() {
            return Some(PathBuf::from(path));
        }
    }
    None
}

/// True if a child is currently alive. Reaps the handle if the child has exited
/// (e.g. crashed), so status reflects reality rather than a stale handle.
fn is_running(slot: &mut Option<Child>) -> bool {
    match slot.as_mut() {
        Some(child) => match child.try_wait() {
            Ok(Some(_)) => {
                *slot = None;
                false
            }
            Ok(None) => true,
            Err(_) => {
                *slot = None;
                false
            }
        },
        None => false,
    }
}

/// Build a PATH for the child so its own `claude` / `node` lookups succeed even
/// though the GUI app's inherited PATH is minimal. Includes the resolved node
/// dir and ~/.local/bin (common claude install location).
fn child_path(node_dir: &str) -> String {
    let home = std::env::var("HOME").unwrap_or_default();
    format!("{node_dir}:{home}/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin")
}

pub fn start(state: &BridgeState) -> Result<(), String> {
    let mut slot = state.0.lock().map_err(|e| e.to_string())?;
    if is_running(&mut slot) {
        return Ok(()); // already running — idempotent
    }
    let node = resolve_node().ok_or("找不到 node 可执行文件（请确认已安装 Node >= 22）")?;
    let script = bridge_script();
    if !script.exists() {
        return Err(format!("找不到桥接器脚本: {}", script.display()));
    }
    let node_dir = node
        .parent()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();
    let child = Command::new(&node)
        .arg(&script)
        .env("PATH", child_path(&node_dir))
        .spawn()
        .map_err(|e| format!("启动桥接器失败: {}", e))?;
    let pid = child.id();
    *slot = Some(child);
    log::info!("claude-bridge started (pid={})", pid);
    Ok(())
}

pub fn stop(state: &BridgeState) -> Result<(), String> {
    let mut slot = state.0.lock().map_err(|e| e.to_string())?;
    if let Some(mut child) = slot.take() {
        let _ = child.kill();
        let _ = child.wait();
        log::info!("claude-bridge stopped");
    }
    Ok(())
}

pub fn status(state: &BridgeState) -> Result<&'static str, String> {
    let mut slot = state.0.lock().map_err(|e| e.to_string())?;
    Ok(if is_running(&mut slot) { "running" } else { "stopped" })
}

// ── Tauri commands ───────────────────────────────────────────────────

#[tauri::command]
pub fn start_bridge(state: tauri::State<'_, BridgeState>) -> Result<(), String> {
    start(&state)
}

#[tauri::command]
pub fn stop_bridge(state: tauri::State<'_, BridgeState>) -> Result<(), String> {
    stop(&state)
}

#[tauri::command]
pub fn bridge_status(state: tauri::State<'_, BridgeState>) -> Result<String, String> {
    status(&state).map(|s| s.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn script_path_points_at_bridge_entry() {
        let p = bridge_script();
        assert!(
            p.ends_with("claude-bridge/index.mjs"),
            "unexpected script path: {:?}",
            p
        );
    }

    #[test]
    fn is_running_false_when_empty() {
        let mut slot: Option<Child> = None;
        assert!(!is_running(&mut slot));
    }

    #[test]
    fn child_path_includes_node_dir_and_local_bin() {
        let p = child_path("/opt/homebrew/bin");
        assert!(p.starts_with("/opt/homebrew/bin:"));
        assert!(p.contains("/.local/bin"));
    }
}
