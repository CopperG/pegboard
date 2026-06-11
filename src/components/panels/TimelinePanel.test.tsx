import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { invoke } from '@tauri-apps/api/core'
import { TimelinePanel } from '@/components/panels/TimelinePanel'
import { useCanvasStore } from '@/stores/canvas-store'
import { resetCanvasStore } from '@/test/store-utils'
import { makePanelMessage } from '@/test/fixtures'

const timelineData = {
  events: [
    { id: 'e1', title: 'standup', date: '2026-06-10T09:30', checked: true },
    { id: 'e2', title: 'swim', date: '2026-06-10T14:00' },
  ],
  viewMode: 'day' as const,
}

function seedPanel(checkable = true) {
  useCanvasStore.getState().createPanel(
    makePanelMessage({
      panelId: 'tl1',
      panelType: 'timeline',
      data: timelineData,
      interaction: checkable ? { checkable: true } : undefined,
    }),
  )
}

describe('TimelinePanel checkbox', () => {
  beforeEach(() => {
    resetCanvasStore()
    vi.mocked(invoke).mockClear()
  })

  it('renders checkboxes in day view when checkable, state from data', () => {
    seedPanel()
    render(<TimelinePanel panelId="tl1" size="md" data={timelineData} />)
    const boxes = screen.getAllByRole('checkbox')
    expect(boxes).toHaveLength(2)
    expect(boxes[0]).toBeChecked()
    expect(boxes[1]).not.toBeChecked()
  })

  it('renders no checkboxes when not checkable', () => {
    seedPanel(false)
    render(<TimelinePanel panelId="tl1" size="md" data={timelineData} />)
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
  })

  it('checked event title has line-through styling', () => {
    seedPanel()
    render(<TimelinePanel panelId="tl1" size="md" data={timelineData} />)
    expect(screen.getByText('standup').className).toContain('line-through')
    expect(screen.getByText('swim').className).not.toContain('line-through')
  })

  it('checking writes store data optimistically and sends check_item', async () => {
    seedPanel()
    render(<TimelinePanel panelId="tl1" size="md" data={timelineData} />)
    await userEvent.click(screen.getAllByRole('checkbox')[1]!)

    const panel = useCanvasStore.getState().panels.find((p) => p.panelId === 'tl1')!
    const events = (panel.data as typeof timelineData).events
    expect(events.find((e) => e.id === 'e2')!.checked).toBe(true)

    const call = vi.mocked(invoke).mock.calls.find((c) => c[0] === 'send_ws_message')!
    expect(call).toBeDefined()
    const sent = JSON.parse((call[1] as { message: string }).message)
    expect(sent).toMatchObject({
      type: 'panel_user_action',
      action: 'check_item',
      panelId: 'tl1',
      payload: { itemId: 'e2', checked: true },
    })
  })

  it('shows completed counter footer when checkable', () => {
    seedPanel()
    render(<TimelinePanel panelId="tl1" size="md" data={timelineData} />)
    expect(screen.getByText('completed_count')).toBeInTheDocument()
  })
})
