// Singleton realtime subscription manager (Wave 10B)
// Used by useWebSocket message handler and components alike.

import type { RealtimeConfig } from '@/types/panel-protocol'
import type { DataSourceAdapter } from './adapters/types'
import { PollingAdapter } from './adapters/polling'
import { WebSocketSourceAdapter } from './adapters/websocket'
import { FileWatchAdapter } from './adapters/file-watch'
import { useCanvasStore } from '@/stores/canvas-store'

const MAX_CONCURRENT = 5
const KNOWN_SOURCES = new Set(['polling', 'websocket', 'file_watch'])
const MIN_INTERVAL_MS = 1000
const MAX_INTERVAL_MS = 86400000 // 24 hours

interface Subscription {
  adapter: DataSourceAdapter
  config: RealtimeConfig
  unsubData: () => void
  unsubError: () => void
}

function createAdapter(source: string): DataSourceAdapter {
  switch (source) {
    case 'websocket':
      return new WebSocketSourceAdapter()
    case 'file_watch':
      return new FileWatchAdapter()
    case 'polling':
    default:
      return new PollingAdapter()
  }
}

class RealtimeManager {
  private subscriptions = new Map<string, Subscription>()

  start(panelId: string, config: RealtimeConfig): void {
    if (!config.enabled) return

    // Validate config source type
    if (!KNOWN_SOURCES.has(config.source)) {
      console.warn(`[Realtime] Unknown source type "${config.source}" for panel ${panelId}, falling back to polling`)
    }

    // Validate interval bounds
    if (config.interval < MIN_INTERVAL_MS) {
      console.warn(`[Realtime] Interval ${config.interval}ms too low for panel ${panelId}, clamping to ${MIN_INTERVAL_MS}ms`)
      config = { ...config, interval: MIN_INTERVAL_MS }
    } else if (config.interval > MAX_INTERVAL_MS) {
      console.warn(`[Realtime] Interval ${config.interval}ms too high for panel ${panelId}, clamping to ${MAX_INTERVAL_MS}ms`)
      config = { ...config, interval: MAX_INTERVAL_MS }
    }

    // Check max concurrent limit
    if (this.subscriptions.size >= MAX_CONCURRENT && !this.subscriptions.has(panelId)) {
      return
    }

    // Stop existing subscription if any
    this.stop(panelId)

    const adapter = createAdapter(config.source)

    const unsubData = adapter.onData((data) => {
      useCanvasStore.getState().updatePanel(panelId, data)
    })

    const unsubError = adapter.onError((error) => {
      console.error(`[Realtime] Error on panel ${panelId}:`, error)
    })

    adapter.connect(config)
    this.subscriptions.set(panelId, { adapter, config, unsubData, unsubError })
  }

  stop(panelId: string): void {
    const sub = this.subscriptions.get(panelId)
    if (sub) {
      sub.unsubData()
      sub.unsubError()
      sub.adapter.disconnect()
      this.subscriptions.delete(panelId)
    }
  }

  setInterval(panelId: string, interval: number): void {
    const sub = this.subscriptions.get(panelId)
    if (sub && 'setInterval' in sub.adapter) {
      ;(sub.adapter as PollingAdapter).setInterval(interval)
    }
  }

  stopAll(): void {
    // Collect IDs first to avoid mutating the Map during iteration
    const ids = [...this.subscriptions.keys()]
    for (const panelId of ids) {
      this.stop(panelId)
    }
  }

  getActiveCount(): number {
    return this.subscriptions.size
  }

  /** Remove subscriptions for panels that no longer exist */
  pruneStale(activePanelIds: Set<string>): void {
    const staleIds: string[] = []
    this.subscriptions.forEach((_sub, panelId) => {
      if (!activePanelIds.has(panelId)) {
        staleIds.push(panelId)
      }
    })
    for (const id of staleIds) {
      this.stop(id)
    }
  }
}

export const realtimeManager = new RealtimeManager()
