// File-watch adapter using Tauri invoke for file reading (Wave 10B)
// Uses a polling approach: reads file content periodically via Tauri command.

import { invoke } from '@tauri-apps/api/core'
import type { RealtimeConfig } from '@/types/panel-protocol'
import type { DataSourceAdapter, AdapterStatus } from './types'
import { isValidFilePath } from '@/lib/url-validation'

export class FileWatchAdapter implements DataSourceAdapter {
  type = 'file_watch' as const
  status: AdapterStatus = 'idle'

  private timer: ReturnType<typeof setInterval> | null = null
  private dataCallbacks = new Set<(data: unknown) => void>()
  private errorCallbacks = new Set<(error: Error) => void>()
  private consecutiveErrors = 0
  private currentConfig: RealtimeConfig | null = null
  private lastContent: string | null = null

  connect(config: RealtimeConfig): void {
    this.disconnect()
    this.currentConfig = config
    this.consecutiveErrors = 0
    this.lastContent = null

    const filePath = config.url ?? (config.params?.path as string | undefined)
    if (!filePath) {
      this.status = 'error'
      this.errorCallbacks.forEach((cb) =>
        cb(new Error('No file path configured for file-watch adapter')),
      )
      return
    }

    // Validate file path: block directory traversal and sensitive files
    if (!isValidFilePath(filePath)) {
      console.warn('[FileWatchAdapter] Blocked access to invalid or sensitive path:', filePath)
      this.status = 'error'
      this.errorCallbacks.forEach((cb) =>
        cb(new Error('File path rejected: path traversal or sensitive file access blocked')),
      )
      return
    }

    this.status = 'connected'
    this.startFilePolling(filePath, config)
  }

  disconnect(): void {
    if (this.timer !== null) {
      clearInterval(this.timer)
      this.timer = null
    }
    this.status = 'idle'
    this.currentConfig = null
    this.lastContent = null
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

  private startFilePolling(filePath: string, config: RealtimeConfig): void {
    const interval = config.interval || 5000
    // Fire immediately, then on interval
    void this.readAndNotify(filePath)
    this.timer = setInterval(() => {
      void this.readAndNotify(filePath)
    }, interval)
  }

  private async readAndNotify(filePath: string): Promise<void> {
    try {
      const content = await invoke<string>('read_file_content', { path: filePath })
      // Only notify if content changed
      if (content === this.lastContent) return
      this.lastContent = content

      const data: unknown = JSON.parse(content)
      this.consecutiveErrors = 0
      this.status = 'connected'
      this.dataCallbacks.forEach((cb) => cb(data))
    } catch (error) {
      this.consecutiveErrors++
      const maxRetries = this.currentConfig?.maxRetries ?? 3
      if (this.consecutiveErrors >= maxRetries) {
        this.status = 'error'
        this.errorCallbacks.forEach((cb) => cb(error as Error))
        this.disconnect()
      }
    }
  }
}
