import { describe, it, expect, beforeEach, vi } from 'vitest'
import { invoke } from '@tauri-apps/api/core'
import { loadSavedState } from '@/hooks/usePersistence'
import { useCanvasStore } from '@/stores/canvas-store'
import { resetCanvasStore } from '@/test/store-utils'

describe('loadSavedState', () => {
  beforeEach(() => {
    resetCanvasStore()
    vi.mocked(invoke).mockReset()
    vi.mocked(invoke).mockResolvedValue(undefined)
  })

  it('restores panels with interaction, realtime and persisted timestamps', async () => {
    const saved = {
      panels: [
        {
          panelId: 'p1',
          panelType: 'list',
          title: 'Todos',
          size: 'md',
          pinned: false,
          zone: 'right',
          data: { items: [{ id: '1', title: 'a', checked: true }] },
          interaction: { checkable: true },
          realtime: { enabled: true, source: 'ws', interval: 5000, maxRetries: 3 },
          createdAt: '2026-06-01T08:00:00.000Z',
          updatedAt: '2026-06-09T12:00:00.000Z',
          starred: false,
          tags: ['daily'],
        },
      ],
      archivedPanels: [],
      activeView: 'daily',
      panelLayouts: {},
    }
    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      if (cmd === 'load_canvas_state') return JSON.stringify(saved)
      return undefined
    })

    await loadSavedState()

    const panel = useCanvasStore.getState().panels.find((p) => p.panelId === 'p1')!
    expect(panel).toBeDefined()
    expect(panel.interaction).toEqual({ checkable: true })
    expect(panel.realtime).toEqual({ enabled: true, source: 'ws', interval: 5000, maxRetries: 3 })
    expect(panel.createdAt).toBe('2026-06-01T08:00:00.000Z')
    expect(panel.updatedAt).toBe('2026-06-09T12:00:00.000Z')
    expect(useCanvasStore.getState().activeView).toBe('daily')
  })
})
