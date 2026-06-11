// WebSocket server using tokio-tungstenite
// Listens on ws://localhost:9800
// Forwards received messages to frontend via Tauri events
// Sends messages from frontend to connected WS clients
// Supports: token auth, canvas state queries, streaming passthrough

use futures_util::{SinkExt, StreamExt};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Instant;
use tauri::{AppHandle, Emitter};
use tokio::net::TcpListener;
use tokio::sync::{mpsc, Mutex, RwLock};
use tokio_tungstenite::tungstenite::handshake::server::{ErrorResponse, Request, Response};
use tokio_tungstenite::tungstenite::http;
use tokio_tungstenite::tungstenite::protocol::WebSocketConfig;
use tokio_tungstenite::tungstenite::Message;

/// Per-client bounded queue size. A client this far behind (1024 messages)
/// is dead or stuck; we drop it explicitly instead of silently losing
/// messages (the old broadcast::Lagged behavior).
pub const CLIENT_QUEUE_CAPACITY: usize = 1024;

/// Compare without early exit so timing does not leak the match length.
fn constant_time_eq(a: &str, b: &str) -> bool {
    if a.len() != b.len() {
        return false;
    }
    a.bytes().zip(b.bytes()).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}

// Shared state for connected clients
pub struct WsState {
    clients: RwLock<HashMap<u64, mpsc::Sender<String>>>,
    next_id: std::sync::atomic::AtomicU64,
    /// Timestamp of last successful client connection (epoch millis)
    pub last_connected_at: RwLock<Option<u64>>,
    /// Total number of connections since server start
    pub total_connections: std::sync::atomic::AtomicU32,
}

impl WsState {
    pub fn new() -> Self {
        Self {
            clients: RwLock::new(HashMap::new()),
            next_id: std::sync::atomic::AtomicU64::new(1),
            last_connected_at: RwLock::new(None),
            total_connections: std::sync::atomic::AtomicU32::new(0),
        }
    }

    pub async fn register(&self) -> (u64, mpsc::Receiver<String>) {
        let (tx, rx) = mpsc::channel(CLIENT_QUEUE_CAPACITY);
        let id = self.next_id.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        self.clients.write().await.insert(id, tx);
        (id, rx)
    }

    pub async fn unregister(&self, id: u64) {
        self.clients.write().await.remove(&id);
    }

    pub async fn client_count(&self) -> usize {
        self.clients.read().await.len()
    }

    /// Deliver to every connected client. Returns the number of successful
    /// deliveries.
    ///
    /// Backpressure contract (spans this method and `handle_connection`):
    /// a client whose bounded queue is Full (too far behind) or already Closed
    /// is removed from `clients` here, which drops its `mpsc::Sender`. That
    /// causes the matching per-connection send loop (`rx.recv()` in
    /// `handle_connection`) to observe channel close, break, and tear down the
    /// socket. So "removed from the map here" is the single trigger that ends
    /// the connection — no message is silently lost the way `broadcast::Lagged`
    /// used to drop them.
    pub async fn send_to_all(&self, msg: &str) -> usize {
        let mut stale: Vec<u64> = Vec::new();
        let mut delivered = 0usize;
        {
            let clients = self.clients.read().await;
            for (id, tx) in clients.iter() {
                match tx.try_send(msg.to_string()) {
                    Ok(()) => delivered += 1,
                    Err(mpsc::error::TrySendError::Full(_)) => {
                        log::warn!("WS client {} backlog full ({}), dropping client", id, CLIENT_QUEUE_CAPACITY);
                        stale.push(*id);
                    }
                    Err(mpsc::error::TrySendError::Closed(_)) => stale.push(*id),
                }
            }
        }
        if !stale.is_empty() {
            let mut clients = self.clients.write().await;
            for id in stale {
                clients.remove(&id);
            }
        }
        delivered
    }
}

// Start WebSocket server — call this from lib.rs setup
pub async fn start_ws_server(
    app_handle: AppHandle,
    ws_state: Arc<WsState>,
    canvas_state: Arc<RwLock<String>>,
    panels_data: Arc<RwLock<String>>,
    ws_token: Arc<RwLock<String>>,
) {
    let listener = match TcpListener::bind("127.0.0.1:9800").await {
        Ok(l) => l,
        Err(e) => {
            log::error!("Failed to bind WS server on :9800: {}", e);
            return;
        }
    };
    log::info!("WebSocket server listening on ws://127.0.0.1:9800");

    // Emit initial status
    let _ = app_handle.emit(
        "ws-status-change",
        serde_json::json!({
            "status": "listening",
            "port": 9800
        }),
    );

    // WebSocket config with message size limits
    let mut ws_config = WebSocketConfig::default();
    ws_config.max_message_size = Some(16 * 1024 * 1024); // 16MB max message
    ws_config.max_frame_size = Some(4 * 1024 * 1024);     // 4MB max frame

    loop {
        match listener.accept().await {
            Ok((stream, addr)) => {
                log::info!("New WS connection from: {}", addr);
                let app = app_handle.clone();
                let state = ws_state.clone();
                let cs = canvas_state.clone();
                let pd = panels_data.clone();
                let tk = ws_token.clone();
                tokio::spawn(handle_connection(stream, app, state, cs, pd, tk, ws_config));
            }
            Err(e) => {
                log::error!("Failed to accept WS connection: {}", e);
            }
        }
    }
}

async fn handle_connection(
    stream: tokio::net::TcpStream,
    app_handle: AppHandle,
    ws_state: Arc<WsState>,
    canvas_state: Arc<RwLock<String>>,
    panels_data: Arc<RwLock<String>>,
    ws_token: Arc<RwLock<String>>,
    ws_config: WebSocketConfig,
) {
    let addr = stream.peer_addr().map(|a| a.to_string()).unwrap_or_default();

    // Read expected token for auth check
    let token_expected = ws_token.read().await.clone();

    // Auth callback: validate token from query string
    let callback = move |req: &Request, response: Response| -> Result<Response, ErrorResponse> {
        let uri = req.uri().to_string();
        // Parse query string for token parameter
        let url_token = uri
            .split('?')
            .nth(1)
            .and_then(|query| {
                query
                    .split('&')
                    .find(|param| param.starts_with("token="))
                    .map(|param| &param[6..]) // skip "token="
            });

        if !token_expected.is_empty() {
            match url_token {
                Some(t) if constant_time_eq(t, &token_expected) => {
                    log::info!("WS auth accepted");
                    Ok(response)
                }
                _ => {
                    log::warn!("WS auth rejected: invalid or missing token");
                    Err(Response::builder()
                        .status(http::StatusCode::FORBIDDEN)
                        .body(Some("Forbidden: invalid token".to_string()))
                        .unwrap())
                }
            }
        } else {
            // No token configured yet, allow connection
            Ok(response)
        }
    };

    let ws_stream = match tokio_tungstenite::accept_hdr_async_with_config(stream, callback, Some(ws_config)).await {
        Ok(ws) => ws,
        Err(e) => {
            log::warn!("WS auth rejected or handshake failed: {}", e);
            return;
        }
    };

    // Track connection stats
    let now_ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;
    *ws_state.last_connected_at.write().await = Some(now_ms);
    ws_state.total_connections.fetch_add(1, std::sync::atomic::Ordering::Relaxed);

    // Notify frontend of new connection
    let _ = app_handle.emit(
        "ws-status-change",
        serde_json::json!({
            "status": "connected"
        }),
    );

    let (write, mut read) = ws_stream.split();
    let (client_id, mut rx) = ws_state.register().await;

    // Wrap write in Arc<Mutex> for sharing between read and send tasks
    let write = Arc::new(Mutex::new(write));
    let write_clone = write.clone();

    // Task: forward this client's queued messages to the socket
    let send_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            let mut w = write_clone.lock().await;
            if w.send(Message::Text(msg.into())).await.is_err() {
                break;
            }
        }
    });

    // Task: Read messages from client, handle or emit to frontend
    let app = app_handle.clone();
    let cs = canvas_state.clone();
    let pd = panels_data.clone();
    let addr_clone = addr.clone();
    let read_task = tokio::spawn(async move {
        // Rate limiting state
        let mut msg_count: u32 = 0;
        let mut window_start = Instant::now();

        while let Some(msg) = read.next().await {
            // Rate limiting: max 100 messages per second
            if window_start.elapsed().as_secs() >= 1 {
                msg_count = 0;
                window_start = Instant::now();
            }
            msg_count += 1;
            if msg_count > 100 {
                eprintln!("[ws] Rate limit exceeded for {}", addr_clone);
                break; // disconnect
            }

            match msg {
                Ok(Message::Text(text)) => {
                    let text_str = text.to_string();
                    log::debug!("WS received: {}", text_str);

                    // Try to parse as JSON and check for special message types
                    if let Ok(json) = serde_json::from_str::<serde_json::Value>(&text_str) {
                        let msg_type = json.get("type").and_then(|t| t.as_str());

                        match msg_type {
                            Some("get_canvas_state") => {
                                // Respond directly with cached canvas state
                                let state = cs.read().await.clone();
                                let response = format!(
                                    r#"{{"type":"canvas_state_response","canvasState":{}}}"#,
                                    state
                                );
                                let mut w = write.lock().await;
                                let _ = w.send(Message::Text(response.into())).await;
                                continue; // Don't forward to frontend
                            }
                            Some("get_panel_detail") => {
                                // Extract specific panel from cached full panels data
                                let panel_id = json
                                    .get("panelId")
                                    .and_then(|p| p.as_str())
                                    .unwrap_or("");
                                let panels_json = pd.read().await.clone();
                                let response_json =
                                    if let Ok(panels_map) = serde_json::from_str::<serde_json::Value>(&panels_json) {
                                        if let Some(panel) = panels_map.get(panel_id) {
                                            serde_json::json!({
                                                "type": "panel_detail_response",
                                                "panelId": panel_id,
                                                "panel": panel
                                            })
                                        } else {
                                            serde_json::json!({
                                                "type": "panel_detail_response",
                                                "panelId": panel_id,
                                                "error": "Panel not found"
                                            })
                                        }
                                    } else {
                                        serde_json::json!({
                                            "type": "panel_detail_response",
                                            "panelId": panel_id,
                                            "error": "No panels data cached"
                                        })
                                    };
                                let response = response_json.to_string();
                                let mut w = write.lock().await;
                                let _ = w.send(Message::Text(response.into())).await;
                                continue; // Don't forward to frontend
                            }
                            _ => {
                                // All other messages: forward to frontend via Tauri event
                                let _ = app.emit("ws-message", &text_str);
                            }
                        }
                    } else {
                        // Not valid JSON — still forward to frontend
                        let _ = app.emit("ws-message", &text_str);
                    }
                }
                Ok(Message::Ping(data)) => {
                    let mut w = write.lock().await;
                    let _ = w.send(Message::Pong(data)).await;
                }
                Ok(Message::Close(_)) => {
                    log::info!("WS client disconnected");
                    break;
                }
                Err(e) => {
                    log::error!("WS read error: {}", e);
                    break;
                }
                _ => {}
            }
        }
    });

    // Wait for either task to finish
    tokio::select! {
        _ = send_task => {},
        _ = read_task => {},
    }

    ws_state.unregister(client_id).await;

    // Notify frontend of disconnection
    let _ = app_handle.emit(
        "ws-status-change",
        serde_json::json!({
            "status": "disconnected"
        }),
    );
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn token_compare() {
        assert!(constant_time_eq("abc123", "abc123"));
        assert!(!constant_time_eq("abc123", "abc124"));
        assert!(!constant_time_eq("abc", "abc123"));
        assert!(!constant_time_eq("", "a"));
        assert!(constant_time_eq("", ""));
    }

    #[tokio::test]
    async fn mpsc_register_send_unregister() {
        let state = WsState::new();
        let (id, mut rx) = state.register().await;
        assert_eq!(state.send_to_all("hello").await, 1);
        assert_eq!(rx.recv().await.unwrap(), "hello");
        state.unregister(id).await;
        assert_eq!(state.send_to_all("x").await, 0);
        assert_eq!(state.client_count().await, 0);
    }

    #[tokio::test]
    async fn mpsc_drops_client_with_full_backlog() {
        let state = WsState::new();
        let (_id, _rx) = state.register().await;
        // Fill the bounded queue without draining rx
        for i in 0..CLIENT_QUEUE_CAPACITY {
            assert_eq!(state.send_to_all(&format!("m{}", i)).await, 1);
        }
        // One more: queue full -> client dropped
        assert_eq!(state.send_to_all("overflow").await, 0);
        assert_eq!(state.client_count().await, 0);
    }
}
