// WebSocket server using tokio-tungstenite
// Listens on ws://localhost:9800
// Forwards received messages to frontend via Tauri events
// Sends messages from frontend to connected WS clients
// Supports: token auth, canvas state queries, streaming passthrough

use futures_util::{SinkExt, StreamExt};
use std::sync::Arc;
use std::time::Instant;
use tauri::{AppHandle, Emitter};
use tokio::net::TcpListener;
use tokio::sync::{broadcast, Mutex, RwLock};
use tokio_tungstenite::tungstenite::handshake::server::{ErrorResponse, Request, Response};
use tokio_tungstenite::tungstenite::http;
use tokio_tungstenite::tungstenite::protocol::WebSocketConfig;
use tokio_tungstenite::tungstenite::Message;

// Shared state for connected clients
pub struct WsState {
    pub tx: broadcast::Sender<String>,
    /// Timestamp of last successful client connection (epoch millis)
    pub last_connected_at: RwLock<Option<u64>>,
    /// Total number of connections since server start
    pub total_connections: std::sync::atomic::AtomicU32,
}

impl WsState {
    pub fn new() -> Self {
        let (tx, _) = broadcast::channel(100);
        Self {
            tx,
            last_connected_at: RwLock::new(None),
            total_connections: std::sync::atomic::AtomicU32::new(0),
        }
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
                Some(t) if t == token_expected => {
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
    let mut rx = ws_state.tx.subscribe();

    // Wrap write in Arc<Mutex> for sharing between read and send tasks
    let write = Arc::new(Mutex::new(write));
    let write_clone = write.clone();

    // Task: Forward messages from broadcast channel to this client
    let send_task = tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
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

    // Notify frontend of disconnection
    let _ = app_handle.emit(
        "ws-status-change",
        serde_json::json!({
            "status": "disconnected"
        }),
    );
}
