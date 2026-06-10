import { describe, it, expect } from 'vitest'
import { buildPrompt, pruneCanvasState } from './prompt.mjs'

describe('pruneCanvasState', () => {
  it('keeps only summary fields per panel', () => {
    const pruned = pruneCanvasState({
      activeView: 'work',
      pinnedPanels: [{ id: 'p1', type: 'table', title: 'T', dataSummary: 'big', layout: { x: 0 }, tags: ['work'], starred: true }],
      transientPanels: [],
    })
    expect(pruned.pinnedPanels[0]).toEqual({ id: 'p1', type: 'table', title: 'T', tags: ['work'], starred: true })
    expect(pruned.activeView).toBe('work')
  })

  it('caps total panels at 30 and adds a note', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ id: `p${i}`, type: 'text', title: `t${i}` }))
    const pruned = pruneCanvasState({ pinnedPanels: many, transientPanels: many })
    const total = pruned.pinnedPanels.length + pruned.transientPanels.length
    expect(total).toBeLessThanOrEqual(30)
    expect(pruned.note).toContain('omitted')
  })

  it('returns null for missing state', () => {
    expect(pruneCanvasState(undefined)).toBeNull()
  })
})

describe('buildPrompt', () => {
  it('plain content passes through with instruction footer', () => {
    const p = buildPrompt({ content: '你好' })
    expect(p).toContain('你好')
    expect(p).toContain('pegboard skill')
  })

  it('includes referenced panels with truncated data', () => {
    const p = buildPrompt({
      content: 'x',
      referencedPanels: [
        { panelId: 'panel-1', panelType: 'table', data: { rows: [1] } },
        { panelId: 'panel-2', panelType: 'text', data: { s: 'a'.repeat(10000) } },
      ],
    })
    expect(p).toContain('panel-1')
    expect(p).toContain('"rows":[1]')
    expect(p).toContain('(truncated)')
  })

  it('includes attachments and pruned canvas state', () => {
    const p = buildPrompt({
      content: 'x',
      attachments: [{ path: '/tmp/a.png', mimeType: 'image/png', size: 10, name: 'a.png', type: 'image' }],
      canvasState: { activeView: 'work', pinnedPanels: [{ id: 'p1', type: 'kv', title: 'K', dataSummary: 'xx' }], transientPanels: [] },
    })
    expect(p).toContain('/tmp/a.png')
    expect(p).toContain('"activeView":"work"')
    expect(p).not.toContain('dataSummary')
  })
})
