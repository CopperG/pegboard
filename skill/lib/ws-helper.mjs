import { readFile } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'

/**
 * Read the WS authentication token from the local config file.
 * Returns null if the file doesn't exist or is malformed.
 */
export async function getWsToken() {
  try {
    const tokenPath = join(homedir(), '.pegboard', 'config', 'ws-token.json')
    const content = await readFile(tokenPath, 'utf-8')
    const { token } = JSON.parse(content)
    return token || null
  } catch {
    return null
  }
}

/**
 * Build the WebSocket URL with an optional token query parameter.
 *
 * NOTE: Token passed via query parameter for compatibility with the Rust WS
 * server's current handshake handling. Future improvement: Use
 * Sec-WebSocket-Protocol header for token auth, which would require
 * coordinated changes in src-tauri/src/ws_server.rs.
 */
export function getWsUrl(token) {
  const base = 'ws://localhost:9800'
  return token ? `${base}?token=${token}` : base
}

/**
 * Open a short-lived WebSocket connection, send a JSON message, and close.
 * Resolves with a success string or rejects on timeout / connection error.
 */
export function sendWsMessage(message) {
  return new Promise(async (resolve, reject) => {
    const token = await getWsToken()
    const url = getWsUrl(token)
    const ws = new WebSocket(url)

    const timeout = setTimeout(() => {
      ws.close()
      reject(new Error('WebSocket 连接超时'))
    }, 5000)

    ws.onopen = () => {
      ws.send(JSON.stringify(message))
      clearTimeout(timeout)
      ws.close()
      resolve('操作已发送')
    }

    ws.onerror = (err) => {
      clearTimeout(timeout)
      reject(new Error(`WebSocket 连接失败：${err}`))
    }
  })
}

/**
 * Open a short-lived WebSocket connection, send a JSON message,
 * wait for the first matching response, then close.
 * Used for request-response queries (e.g. get_canvas_state, get_panel_detail).
 */
export function sendWsQuery(message, responseType, timeoutMs = 3000) {
  return new Promise(async (resolve, reject) => {
    const token = await getWsToken()
    const url = getWsUrl(token)
    const ws = new WebSocket(url)

    const timeout = setTimeout(() => {
      ws.close()
      reject(new Error('WebSocket 查询超时'))
    }, timeoutMs)

    ws.onopen = () => {
      ws.send(JSON.stringify(message))
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === responseType) {
          clearTimeout(timeout)
          ws.close()
          resolve(data)
        }
        // Ignore non-target messages (e.g. broadcast), keep waiting
      } catch {
        // Ignore parse errors, keep waiting
      }
    }

    ws.onerror = (err) => {
      clearTimeout(timeout)
      reject(new Error(`WebSocket 查询失败：${err}`))
    }
  })
}
