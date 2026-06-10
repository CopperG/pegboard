import { describe, it, expect, beforeEach } from 'vitest'
import { useChatStore } from './chat-store'

describe('chat-store appendToMessage', () => {
  beforeEach(() => {
    useChatStore.getState().clearMessages()
  })

  it('appends to the message with the given id', () => {
    const s = useChatStore.getState()
    s.addMessage({ id: 'm1', role: 'agent', content: 'a', timestamp: 't' })
    s.addMessage({ id: 'm2', role: 'agent', content: 'x', timestamp: 't' })
    s.appendToMessage('m1', 'b')
    const msgs = useChatStore.getState().messages
    expect(msgs.find((m) => m.id === 'm1')?.content).toBe('ab')
    expect(msgs.find((m) => m.id === 'm2')?.content).toBe('x')
  })

  it('ignores unknown message ids', () => {
    const s = useChatStore.getState()
    s.addMessage({ id: 'm1', role: 'agent', content: 'a', timestamp: 't' })
    s.appendToMessage('nope', 'b')
    expect(useChatStore.getState().messages[0]!.content).toBe('a')
  })
})
