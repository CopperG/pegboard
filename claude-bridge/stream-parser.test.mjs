import { describe, it, expect } from 'vitest'
import { createSessionState, resetTurn, interpretEvent } from './stream-parser.mjs'

describe('interpretEvent', () => {
  it('captures session id from init', () => {
    const s = createSessionState()
    expect(interpretEvent({ type: 'system', subtype: 'init', session_id: 'sess-1' }, s))
      .toEqual([{ kind: 'session', id: 'sess-1' }])
  })

  it('emits chunk for text_delta and marks streamed', () => {
    const s = createSessionState()
    const ev = { type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'hi' } } }
    expect(interpretEvent(ev, s)).toEqual([{ kind: 'chunk', text: 'hi' }])
    expect(s.streamed).toBe(true)
  })

  it('drops subagent events (parent_tool_use_id)', () => {
    const s = createSessionState()
    const ev = {
      type: 'stream_event',
      parent_tool_use_id: 'tool-123',
      event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'leak' } },
    }
    expect(interpretEvent(ev, s)).toEqual([])
    expect(s.streamed).toBe(false)
  })

  it('result emits done; falls back to result text when nothing streamed', () => {
    const s = createSessionState()
    expect(interpretEvent({ type: 'result', subtype: 'success', result: 'final', session_id: 'sess-2' }, s))
      .toEqual([
        { kind: 'session', id: 'sess-2' },
        { kind: 'chunk', text: 'final' },
        { kind: 'done' },
      ])
  })

  it('result does not duplicate text when chunks were streamed', () => {
    const s = createSessionState()
    s.streamed = true
    expect(interpretEvent({ type: 'result', subtype: 'success', result: 'final' }, s))
      .toEqual([{ kind: 'done' }])
  })

  it('resetTurn clears streamed flag between turns', () => {
    const s = createSessionState()
    s.streamed = true
    resetTurn(s)
    expect(s.streamed).toBe(false)
  })

  it('ignores unrelated events', () => {
    const s = createSessionState()
    expect(interpretEvent({ type: 'assistant', message: {} }, s)).toEqual([])
  })
})
