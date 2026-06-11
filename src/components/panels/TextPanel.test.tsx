import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { invoke } from '@tauri-apps/api/core'
import { TextPanel, countWords } from '@/components/panels/TextPanel'
import { useCanvasStore } from '@/stores/canvas-store'
import { resetCanvasStore } from '@/test/store-utils'
import { makePanelMessage } from '@/test/fixtures'

describe('TextPanel', () => {
  it('wraps content in a scrollable container', () => {
    const { container } = render(
      <TextPanel
        panelId="p1"
        size="md"
        data={{ summary: 's', content: 'long\n'.repeat(200), format: 'plaintext' }}
      />,
    )
    expect(container.querySelector('.overflow-y-auto')).not.toBeNull()
  })
})

const textData = {
  summary: 'summary',
  content: '# Title\n\noriginal body',
  format: 'markdown' as const,
  wordCount: 5,
}

function seedEditablePanel() {
  useCanvasStore.getState().createPanel(
    makePanelMessage({
      panelId: 'tp1',
      panelType: 'text',
      data: textData,
      interaction: { editable: true },
    }),
  )
}

describe('countWords', () => {
  it('counts CJK per char and latin per word', () => {
    expect(countWords('你好 world')).toBe(3)
    expect(countWords('')).toBe(0)
  })
})

describe('TextPanel double-click editing', () => {
  beforeEach(() => {
    resetCanvasStore()
    vi.mocked(invoke).mockClear()
  })

  it('enters edit mode on double click when editable', async () => {
    seedEditablePanel()
    render(<TextPanel panelId="tp1" size="md" data={textData} />)
    await userEvent.dblClick(screen.getByText('original body'))
    expect(screen.getByRole('textbox')).toHaveValue('# Title\n\noriginal body')
  })

  it('ignores double click when not editable', async () => {
    useCanvasStore.getState().createPanel(
      makePanelMessage({ panelId: 'tp1', panelType: 'text', data: textData }),
    )
    render(<TextPanel panelId="tp1" size="md" data={textData} />)
    await userEvent.dblClick(screen.getByText('original body'))
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('save merges fresh data, replaces only content, recomputes wordCount, sends edit_value', async () => {
    seedEditablePanel()
    render(<TextPanel panelId="tp1" size="md" data={textData} />)
    await userEvent.dblClick(screen.getByText('original body'))
    const box = screen.getByRole('textbox')
    await userEvent.clear(box)
    await userEvent.type(box, 'new content here')
    await userEvent.click(screen.getByText('save'))

    const panel = useCanvasStore.getState().panels.find((p) => p.panelId === 'tp1')!
    const d = panel.data as typeof textData
    expect(d.content).toBe('new content here')
    expect(d.summary).toBe('summary')
    expect(d.format).toBe('markdown')
    expect(d.wordCount).toBe(countWords('new content here'))

    const call = vi.mocked(invoke).mock.calls.find((c) => c[0] === 'send_ws_message')!
    expect(call).toBeDefined()
    const sent = JSON.parse((call[1] as { message: string }).message)
    expect(sent).toMatchObject({
      type: 'panel_user_action',
      action: 'edit_value',
      panelId: 'tp1',
      payload: { field: 'content', newValue: 'new content here' },
    })
  })

  it('escape cancels without store change or message', async () => {
    seedEditablePanel()
    render(<TextPanel panelId="tp1" size="md" data={textData} />)
    await userEvent.dblClick(screen.getByText('original body'))
    const box = screen.getByRole('textbox')
    await userEvent.type(box, 'changed')
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('textbox')).toBeNull()
    const panel = useCanvasStore.getState().panels.find((p) => p.panelId === 'tp1')!
    expect((panel.data as typeof textData).content).toBe('# Title\n\noriginal body')
    expect(vi.mocked(invoke).mock.calls.filter((c) => c[0] === 'send_ws_message')).toHaveLength(0)
  })

  it('keeps the editor and draft when agent pushes malformed data mid-edit', async () => {
    seedEditablePanel()
    const { rerender } = render(<TextPanel panelId="tp1" size="md" data={textData} />)
    await userEvent.dblClick(screen.getByText('original body'))
    await userEvent.type(screen.getByRole('textbox'), ' plus my edit')

    const malformed = { summary: 'broken' } // fails isTextPanelData (no content string)
    useCanvasStore.getState().updatePanel('tp1', malformed)
    rerender(<TextPanel panelId="tp1" size="md" data={malformed} />)

    const box = screen.getByRole('textbox')
    expect(box).toBeInTheDocument()
    expect((box as HTMLTextAreaElement).value).toContain('plus my edit')
  })

  it('shows conflict banner on external update while editing, load latest refreshes draft', async () => {
    seedEditablePanel()
    const { rerender } = render(<TextPanel panelId="tp1" size="md" data={textData} />)
    await userEvent.dblClick(screen.getByText('original body'))

    const external = { ...textData, content: 'agent changed this' }
    useCanvasStore.getState().updatePanel('tp1', external)
    rerender(<TextPanel panelId="tp1" size="md" data={external} />)

    expect(screen.getByText('content_changed_externally')).toBeInTheDocument()
    await userEvent.click(screen.getByText('load_latest'))
    expect(screen.getByRole('textbox')).toHaveValue('agent changed this')
    expect(screen.queryByText('content_changed_externally')).toBeNull()
  })
})
