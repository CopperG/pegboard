// HTTP polling adapter (Wave 10B)

import type { RealtimeConfig } from '@/types/panel-protocol'
import type { DataSourceAdapter, AdapterStatus } from './types'
import { isValidExternalHttpUrl } from '@/lib/url-validation'

export class PollingAdapter implements DataSourceAdapter {
  type = 'polling' as const
  status: AdapterStatus = 'idle'

  private timer: ReturnType<typeof setInterval> | null = null
  private dataCallbacks = new Set<(data: unknown) => void>()
  private errorCallbacks = new Set<(error: Error) => void>()
  private consecutiveErrors = 0
  private currentConfig: RealtimeConfig | null = null
  private abortController: AbortController | null = null

  connect(config: RealtimeConfig): void {
    this.disconnect()
    this.currentConfig = config
    this.consecutiveErrors = 0
    this.startPolling(config)
  }

  disconnect(): void {
    if (this.timer !== null) {
      clearInterval(this.timer)
      this.timer = null
    }
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
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

  setInterval(ms: number): void {
    if (!this.currentConfig) return
    this.currentConfig = { ...this.currentConfig, interval: ms }
    // Restart polling with new interval
    if (this.timer !== null) {
      clearInterval(this.timer)
      this.startPolling(this.currentConfig)
    }
  }

  private startPolling(config: RealtimeConfig): void {
    const interval = config.interval || 5000
    // Fire immediately, then on interval
    void this.poll(config)
    this.timer = setInterval(() => {
      void this.poll(config)
    }, interval)
  }

  private async poll(config: RealtimeConfig): Promise<void> {
    if (!config.url) {
      this.status = 'error'
      this.errorCallbacks.forEach((cb) => cb(new Error('No URL configured for polling adapter')))
      this.disconnect()
      return
    }

    // Validate URL: only allow http:/https: to external (non-private) hosts
    if (!isValidExternalHttpUrl(config.url)) {
      console.warn('[PollingAdapter] Blocked request to invalid or private URL:', config.url)
      this.status = 'error'
      this.errorCallbacks.forEach((cb) =>
        cb(new Error('Polling URL rejected: only external http:/https: URLs are allowed')),
      )
      this.disconnect()
      return
    }

    try {
      this.abortController = new AbortController()
      const headers = (config.params?.headers as Record<string, string>) || {}
      // Use the abort controller's signal so disconnect() can cancel in-flight requests.
      // Also apply a 10s timeout via AbortSignal.any.
      const timeoutSignal = AbortSignal.timeout(10000)
      const combinedSignal = AbortSignal.any([this.abortController.signal, timeoutSignal])
      const response = await fetch(config.url, {
        headers,
        signal: combinedSignal,
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data: unknown = await response.json()
      this.consecutiveErrors = 0
      this.status = 'connected'
      this.dataCallbacks.forEach((cb) => cb(data))
    } catch (error) {
      this.consecutiveErrors++
      const maxRetries = config.maxRetries || 3
      if (this.consecutiveErrors >= maxRetries) {
        this.status = 'error'
        this.errorCallbacks.forEach((cb) => cb(error as Error))
        this.disconnect()
      }
    } finally {
      this.abortController = null
    }
  }
}
