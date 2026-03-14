// External WebSocket data-source adapter (Wave 10B)
// Connects to external WebSocket data sources, NOT the PegBoard WS server.

import type { RealtimeConfig } from '@/types/panel-protocol'
import type { DataSourceAdapter, AdapterStatus } from './types'
import { isValidExternalWsUrl } from '@/lib/url-validation'

export class WebSocketSourceAdapter implements DataSourceAdapter {
  type = 'websocket' as const
  status: AdapterStatus = 'idle'

  private ws: WebSocket | null = null
  private reconnectAttempts = 0
  private maxReconnects = 3
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private currentConfig: RealtimeConfig | null = null
  private dataCallbacks = new Set<(data: unknown) => void>()
  private errorCallbacks = new Set<(error: Error) => void>()

  connect(config: RealtimeConfig): void {
    this.disconnect()
    this.currentConfig = config
    this.maxReconnects = config.maxRetries || 3
    this.reconnectAttempts = 0
    this.openConnection(config)
  }

  disconnect(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      // Remove handlers before closing to prevent reconnect
      this.ws.onclose = null
      this.ws.onerror = null
      this.ws.onmessage = null
      this.ws.onopen = null
      this.ws.close()
      this.ws = null
    }
    this.status = 'idle'
    this.currentConfig = null
  }

  onData(callback: (data: unknown) => void): () => void {
    this.dataCallbacks.add(callback)
    return () => {
      this.dataCallbacks.delete(callback)
    }
  }

  onError(callback: (error: Error) => void): () => void {
    this.errorCallbacks.add(callback)
    return () => {
      this.errorCallbacks.delete(callback)
    }
  }

  private openConnection(config: RealtimeConfig): void {
    if (!config.url) {
      this.status = 'error'
      this.errorCallbacks.forEach((cb) => cb(new Error('No URL configured for WebSocket adapter')))
      return
    }

    // Validate URL: only allow ws:/wss: to external (non-private) hosts
    if (!isValidExternalWsUrl(config.url)) {
      console.warn('[WebSocketAdapter] Blocked connection to invalid or private URL:', config.url)
      this.status = 'error'
      this.errorCallbacks.forEach((cb) =>
        cb(new Error('WebSocket URL rejected: only external ws:/wss: URLs are allowed')),
      )
      return
    }

    try {
      this.ws = new WebSocket(config.url)
    } catch (error) {
      this.status = 'error'
      this.errorCallbacks.forEach((cb) => cb(error as Error))
      return
    }

    this.ws.onopen = () => {
      this.status = 'connected'
      this.reconnectAttempts = 0
      // Send subscribe message if config.params.subscribe exists
      if (config.params?.subscribe && this.ws) {
        this.ws.send(JSON.stringify(config.params.subscribe))
      }
    }

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const data: unknown = JSON.parse(event.data as string)
        this.dataCallbacks.forEach((cb) => cb(data))
      } catch {
        // Ignore non-JSON messages
      }
    }

    this.ws.onclose = () => {
      if (!this.currentConfig) return // disconnected intentionally
      this.status = 'idle'
      this.attemptReconnect()
    }

    this.ws.onerror = () => {
      // onerror is always followed by onclose, so reconnect logic is in onclose
      this.status = 'error'
    }
  }

  private attemptReconnect(): void {
    if (!this.currentConfig) return
    if (this.reconnectAttempts >= this.maxReconnects) {
      this.status = 'error'
      this.errorCallbacks.forEach((cb) =>
        cb(new Error(`WebSocket reconnect failed after ${this.maxReconnects} attempts`)),
      )
      this.disconnect()
      return
    }

    this.reconnectAttempts++
    // Exponential backoff: 1s, 2s, 4s, ...
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000)
    this.reconnectTimer = setTimeout(() => {
      if (this.currentConfig) {
        this.openConnection(this.currentConfig)
      }
    }, delay)
  }
}
