import { describe, it, expect, beforeEach } from 'vitest'
import { useCanvasStore } from '@/stores/canvas-store'
import { resetCanvasStore } from '@/test/store-utils'
import type { PanelMessage } from '@/types/panel-protocol'

export function makePanelMessage(overrides: Partial<PanelMessage> = {}): PanelMessage {
  return {
    action: 'create',
    panelId: 'p1',
    pinned: false,
    zone: 'right',
    panelType: 'text',
    title: 'Test',
    size: 'md',
    data: { summary: 's', content: 'hello', format: 'markdown' },
    ...overrides,
  }
}

describe('canvas-store', () => {
  beforeEach(() => resetCanvasStore())

  it('createPanel creates panel and writes createdAt/updatedAt', () => {
    useCanvasStore.getState().createPanel(makePanelMessage())
    const panel = useCanvasStore.getState().panels[0]!
    expect(panel.panelId).toBe('p1')
    expect(Date.parse(panel.createdAt)).not.toBeNaN()
    expect(panel.updatedAt).toBe(panel.createdAt)
  })

  it('updatePanel replaces data and refreshes updatedAt', async () => {
    useCanvasStore.getState().createPanel(makePanelMessage())
    const before = useCanvasStore.getState().panels[0]!.updatedAt
    await new Promise((r) => setTimeout(r, 10))
    useCanvasStore.getState().updatePanel('p1', { summary: 's', content: 'new', format: 'markdown' })
    const panel = useCanvasStore.getState().panels[0]!
    expect((panel.data as { content: string }).content).toBe('new')
    expect(Date.parse(panel.updatedAt)).toBeGreaterThan(Date.parse(before))
  })

  it('getCanvasState summarizes list items using text alias when title missing', () => {
    useCanvasStore.getState().createPanel(
      makePanelMessage({
        panelId: 'list1',
        panelType: 'list',
        data: { items: [{ id: '1', text: 'aliased' }] },
      }),
    )
    const snapshot = useCanvasStore.getState().getCanvasState()
    const summary = [...snapshot.pinnedPanels, ...snapshot.transientPanels].find(
      (p) => p.id === 'list1',
    )
    expect(summary?.dataSummary).toContain('aliased')
  })

  it('restorePanelTimestamps restores persisted timestamps', () => {
    useCanvasStore.getState().createPanel(makePanelMessage())
    useCanvasStore.getState().restorePanelTimestamps([
      { panelId: 'p1', createdAt: '2026-06-01T08:00:00.000Z', updatedAt: '2026-06-09T12:00:00.000Z' },
    ])
    const panel = useCanvasStore.getState().panels[0]!
    expect(panel.createdAt).toBe('2026-06-01T08:00:00.000Z')
    expect(panel.updatedAt).toBe('2026-06-09T12:00:00.000Z')
  })

  it('createPanel passes interaction config through', () => {
    useCanvasStore.getState().createPanel(
      makePanelMessage({ interaction: { checkable: true } }),
    )
    expect(useCanvasStore.getState().panels[0]!.interaction).toEqual({ checkable: true })
  })

  it('createPanel passes realtime config through', () => {
    useCanvasStore.getState().createPanel(
      makePanelMessage({
        realtime: { enabled: true, source: 'ws', interval: 5000, maxRetries: 3 },
      }),
    )
    expect(useCanvasStore.getState().panels[0]!.realtime).toEqual({
      enabled: true,
      source: 'ws',
      interval: 5000,
      maxRetries: 3,
    })
  })
})
