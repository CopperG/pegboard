import { useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useCanvasStore } from '@/stores/canvas-store'
import { toast } from 'sonner'

export function usePersistence() {
  useEffect(() => {
    // 1. Ensure data directories exist
    invoke('ensure_data_dirs').catch(console.error)

    // 2. Load saved state on startup
    // createPanel deduplicates by panelId, safe to call twice under StrictMode
    loadSavedState()

    // 3. Daily snapshot
    handleDailySnapshot()

    // 4. Subscribe to state changes for auto-save
    const unsubscribe = useCanvasStore.subscribe(
      debounce((state: ReturnType<typeof useCanvasStore.getState>) => {
        const json = JSON.stringify({
          panels: state.panels,
          archivedPanels: state.archivedPanels,
          activeView: state.activeView,
          panelLayouts: state.panelLayouts,
        })

        // Save to disk
        invoke('save_canvas_state', { json }).catch((e) => {
          console.error('Failed to save canvas state:', e)
          toast.error('Failed to save', { description: 'Canvas state could not be saved to disk.' })
        })

        // Sync to memory cache (for WS query — listPanels)
        const canvasState = JSON.stringify(
          useCanvasStore.getState().getCanvasState(),
        )
        invoke('sync_canvas_state', { json: canvasState }).catch(console.error)

        // Sync full panel data (for WS query — getPanelDetail)
        const panelsMap: Record<string, unknown> = {}
        for (const p of state.panels) {
          panelsMap[p.panelId] = p
        }
        invoke('sync_panels_data', { json: JSON.stringify(panelsMap) }).catch(console.error)
      }, 500),
    )

    return () => unsubscribe()
  }, [])
}

async function loadSavedState() {
  try {
    const json = await invoke<string | null>('load_canvas_state')
    if (json) {
      const saved = JSON.parse(json)
      const store = useCanvasStore.getState()

      // Restore panels
      if (Array.isArray(saved.panels)) {
        for (const panel of saved.panels) {
          store.createPanel({
            action: 'create',
            panelId: panel.panelId,
            panelType: panel.panelType,
            title: panel.title,
            subtitle: panel.subtitle,
            size: panel.size,
            pinned: panel.pinned,
            zone: panel.zone,
            data: panel.data,
            meta: panel.meta,
            html: panel.html,
            css: panel.css,
            starred: panel.starred,
            tags: panel.tags,
          })
        }
      }

      // Restore archived panels
      if (Array.isArray(saved.archivedPanels)) {
        store.setArchivedPanels(saved.archivedPanels)
      }

      // Restore layout positions
      if (saved.panelLayouts && typeof saved.panelLayouts === 'object') {
        store.setPanelLayouts(saved.panelLayouts)
      }

      // Restore view
      if (saved.activeView) {
        store.switchView(saved.activeView)
      }
    }
  } catch (e) {
    console.error('Failed to load saved state:', e)
  }
}

async function handleDailySnapshot() {
  try {
    const exists = await invoke<boolean>('snapshot_exists_today')
    if (!exists) {
      const state = useCanvasStore.getState()
      const json = JSON.stringify({
        panels: state.panels,
        archivedPanels: state.archivedPanels,
        timestamp: new Date().toISOString(),
      })
      await invoke('create_daily_snapshot', { json })
    }
    // Clean up old snapshots (30 days)
    await invoke('cleanup_old_snapshots', { keepDays: 30 })
  } catch (e) {
    console.error('Snapshot error:', e)
  }
}

function debounce(
  fn: (state: ReturnType<typeof useCanvasStore.getState>) => void,
  ms: number,
): typeof fn {
  let timer: ReturnType<typeof setTimeout>
  return (state) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(state), ms)
  }
}
