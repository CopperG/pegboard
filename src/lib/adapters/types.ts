// Realtime data-source adapter interface (Wave 10B)

import type { RealtimeConfig } from '@/types/panel-protocol'

export type AdapterType = 'polling' | 'websocket' | 'file_watch'
export type AdapterStatus = 'idle' | 'connected' | 'error'

export interface DataSourceAdapter {
  type: AdapterType
  status: AdapterStatus
  connect(config: RealtimeConfig): void
  disconnect(): void
  onData(callback: (data: unknown) => void): () => void // returns unsubscribe
  onError(callback: (error: Error) => void): () => void // returns unsubscribe
}
