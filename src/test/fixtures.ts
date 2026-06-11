import type { PanelMessage } from '@/types/panel-protocol'

/** Shared panel message factory for tests */
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
