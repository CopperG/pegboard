// React hook wrapper for the realtime subscription manager (Wave 10B)
// Provides React-friendly API and auto-cleanup on unmount / panel deletion.

import { useCallback, useEffect } from 'react'
import { useCanvasStore } from '@/stores/canvas-store'
import { realtimeManager } from '@/lib/realtime-manager'
import type { RealtimeConfig } from '@/types/panel-protocol'

export function useRealtimeSubscription() {
  const start = useCallback((panelId: string, config: RealtimeConfig) => {
    realtimeManager.start(panelId, config)
  }, [])

  const stop = useCallback((panelId: string) => {
    realtimeManager.stop(panelId)
  }, [])

  const setInterval = useCallback((panelId: string, interval: number) => {
    realtimeManager.setInterval(panelId, interval)
  }, [])

  // Cleanup all subscriptions on unmount
  useEffect(() => {
    return () => {
      realtimeManager.stopAll()
    }
  }, [])

  // Auto-stop subscriptions when panels are deleted/archived
  useEffect(() => {
    const unsub = useCanvasStore.subscribe((state) => {
      const panelIds = new Set(state.panels.map((p) => p.panelId))
      realtimeManager.pruneStale(panelIds)
    })
    return unsub
  }, [])

  return {
    start,
    stop,
    setInterval,
    getActiveCount: realtimeManager.getActiveCount.bind(realtimeManager),
  }
}
