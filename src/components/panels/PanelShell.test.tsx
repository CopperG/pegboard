import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PanelShell } from '@/components/panels/PanelShell'
import { useCanvasStore } from '@/stores/canvas-store'
import { resetCanvasStore } from '@/test/store-utils'
import { makePanelMessage } from '@/stores/canvas-store.test'

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
})
