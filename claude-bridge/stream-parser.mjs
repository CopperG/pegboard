/** Mutable per-process state; streamed flag is reset每轮 (resetTurn). */
export function createSessionState() {
  return { streamed: false }
}

/** Call at the start of each user turn. */
export function resetTurn(state) {
  state.streamed = false
}

/**
 * Interpret one stream-json event from the persistent claude process.
 * Actions: {kind:'session', id} | {kind:'chunk', text} | {kind:'done'}
 */
export function interpretEvent(event, state) {
  if (!event || typeof event !== 'object') return []
  // Events from Task subagents must never reach the chat bar.
  if (event.parent_tool_use_id) return []

  if (event.type === 'system' && event.subtype === 'init' && event.session_id) {
    return [{ kind: 'session', id: event.session_id }]
  }

  if (event.type === 'stream_event') {
    const delta = event.event?.delta
    if (event.event?.type === 'content_block_delta' && delta?.type === 'text_delta' && delta.text) {
      state.streamed = true
      return [{ kind: 'chunk', text: delta.text }]
    }
    return []
  }

  if (event.type === 'result') {
    const actions = []
    if (event.session_id) actions.push({ kind: 'session', id: event.session_id })
    if (!state.streamed && typeof event.result === 'string' && event.result) {
      actions.push({ kind: 'chunk', text: event.result })
    }
    actions.push({ kind: 'done' })
    return actions
  }

  return []
}
