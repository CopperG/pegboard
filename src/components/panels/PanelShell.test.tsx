import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PanelShell } from '@/components/panels/PanelShell'
import { useCanvasStore } from '@/stores/canvas-store'
import { resetCanvasStore } from '@/test/store-utils'
import { makePanelMessage } from '@/test/fixtures'

describe('PanelShell', () => {
  beforeEach(() => resetCanvasStore())

  it('header shows relative updated time with absolute time as title', () => {
    useCanvasStore.getState().createPanel(makePanelMessage())
    useCanvasStore.getState().restorePanelTimestamps([
      {
        panelId: 'p1',
        updatedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      },
    ])
    render(
      <PanelShell panelId="p1" title="Test" size="md" pinned={false} panelType="text">
        <div>content</div>
      </PanelShell>,
    )
    const time = screen.getByText(/分钟前/)
    expect(time).toBeInTheDocument()
    expect(time).toHaveAttribute('title')
  })

  it('toggling category via store helper updates tags without bumping updatedAt', () => {
    useCanvasStore.getState().createPanel(makePanelMessage({ tags: ['other'] }))
    const before = useCanvasStore.getState().panels[0]!.updatedAt
    useCanvasStore.getState().setTags('p1', ['work'])
    const panel = useCanvasStore.getState().panels[0]!
    expect(panel.tags).toEqual(['work'])
    expect(panel.updatedAt).toBe(before)
  })
})
