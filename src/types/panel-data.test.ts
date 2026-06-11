import { describe, it, expect } from 'vitest'
import {
  ListPanelDataSchema,
  TimelinePanelDataSchema,
} from '@/types/panel-data'

describe('ListPanelDataSchema', () => {
  it('accepts checked and text compat fields', () => {
    const result = ListPanelDataSchema.safeParse({
      items: [
        { id: '1', title: 'milk', checked: true },
        { id: '2', text: 'report' },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('rejects items missing both title and text', () => {
    const result = ListPanelDataSchema.safeParse({
      items: [{ id: '1' }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-boolean checked', () => {
    const result = ListPanelDataSchema.safeParse({
      items: [{ id: '1', title: 'x', checked: 'yes' }],
    })
    expect(result.success).toBe(false)
  })
})

describe('TimelinePanelDataSchema', () => {
  it('accepts event-level checked field', () => {
    const result = TimelinePanelDataSchema.safeParse({
      events: [
        { id: '1', date: '2026-06-10T10:00', title: 'meeting', checked: true },
      ],
      viewMode: 'day',
    })
    expect(result.success).toBe(true)
  })

  it('rejects non-boolean checked', () => {
    const result = TimelinePanelDataSchema.safeParse({
      events: [{ id: '1', date: '2026-06-10T10:00', title: 'meeting', checked: 1 }],
      viewMode: 'day',
    })
    expect(result.success).toBe(false)
  })
})
