import { describe, it, expect } from 'vitest'
import { isResumable, SESSION_MAX_AGE_MS } from './session.mjs'

const NOW = 1_800_000_000_000

describe('isResumable', () => {
  it('accepts a fresh session', () => {
    expect(isResumable({ sessionId: 's1', updatedAt: NOW - 60_000 }, NOW)).toBe(true)
  })

  it('rejects a session older than 24h', () => {
    expect(isResumable({ sessionId: 's1', updatedAt: NOW - SESSION_MAX_AGE_MS - 1 }, NOW)).toBe(false)
  })

  it('rejects future timestamps (clock skew)', () => {
    expect(isResumable({ sessionId: 's1', updatedAt: NOW + 60_000 }, NOW)).toBe(false)
  })

  it('rejects malformed records', () => {
    expect(isResumable(null, NOW)).toBe(false)
    expect(isResumable({}, NOW)).toBe(false)
    expect(isResumable({ sessionId: '', updatedAt: NOW }, NOW)).toBe(false)
    expect(isResumable({ sessionId: 's1' }, NOW)).toBe(false)
  })
})
