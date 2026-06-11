import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { invoke } from '@tauri-apps/api/core'
import { ListPanel } from '@/components/panels/ListPanel'
import { useCanvasStore } from '@/stores/canvas-store'
import { resetCanvasStore } from '@/test/store-utils'
import { makePanelMessage } from '@/test/fixtures'

const listData = {
  items: [
    { id: 'a', title: 'milk', checked: true },
    { id: 'b', title: 'report' },
  ],
}

function seedPanel() {
  useCanvasStore.getState().createPanel(
    makePanelMessage({
      panelId: 'lp1',
      panelType: 'list',
      data: listData,
      interaction: { checkable: true },
    }),
  )
}

describe('ListPanel checked derives from data', () => {
  beforeEach(() => {
    resetCanvasStore()
    vi.mocked(invoke).mockClear()
  })

  afterEach(() => {
    cleanup()
  })

  it('checkbox state comes from data.items[].checked', () => {
    seedPanel()
    render(<ListPanel panelId="lp1" size="md" data={listData} />)
    const boxes = screen.getAllByRole('checkbox')
    // boxes[0] is the select-all box
    expect(boxes[1]).toBeChecked()
    expect(boxes[2]).not.toBeChecked()
  })

  it('agent updates to checked are reflected (old impl read only once)', () => {
    seedPanel()
    const { rerender } = render(<ListPanel panelId="lp1" size="md" data={listData} />)
    const updated = {
      items: [
        { id: 'a', title: 'milk', checked: false },
        { id: 'b', title: 'report', checked: true },
      ],
    }
    rerender(<ListPanel panelId="lp1" size="md" data={updated} />)
    const boxes = screen.getAllByRole('checkbox')
    expect(boxes[1]).not.toBeChecked()
    expect(boxes[2]).toBeChecked()
  })

  it('clicking a checkbox optimistically writes store data and sends check_item', async () => {
    seedPanel()
    render(<ListPanel panelId="lp1" size="md" data={listData} />)
    await userEvent.click(screen.getAllByRole('checkbox')[2]!)

    const panel = useCanvasStore.getState().panels.find((p) => p.panelId === 'lp1')!
    const items = (panel.data as typeof listData).items
    expect(items.find((i) => i.id === 'b')!.checked).toBe(true)

    const call = vi.mocked(invoke).mock.calls.find((c) => c[0] === 'send_ws_message')!
    expect(call).toBeDefined()
    const sent = JSON.parse((call[1] as { message: string }).message)
    expect(sent).toMatchObject({
      type: 'panel_user_action',
      action: 'check_item',
      panelId: 'lp1',
      payload: { itemId: 'b', checked: true },
    })
  })
})
