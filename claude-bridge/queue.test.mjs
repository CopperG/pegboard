import { describe, it, expect, vi } from 'vitest'
import { createTurnQueue } from './queue.mjs'

describe('createTurnQueue', () => {
  it('single-flight: next() returns null while a turn is active', () => {
    const q = createTurnQueue()
    q.push('a')
    q.push('b')
    expect(q.next()).toBe('a')
    expect(q.next()).toBeNull() // active
    q.done()
    expect(q.next()).toBe('b')
  })

  it('rejects pushes beyond capacity and calls onOverflow', () => {
    const onOverflow = vi.fn()
    const q = createTurnQueue({ capacity: 2, onOverflow })
    expect(q.push('a')).toBe(true)
    expect(q.push('b')).toBe(true)
    expect(q.push('c')).toBe(false)
    expect(onOverflow).toHaveBeenCalledWith('c')
  })

  it('reports pending count', () => {
    const q = createTurnQueue()
    q.push('a')
    q.push('b')
    expect(q.pending).toBe(2)
    q.next()
    expect(q.pending).toBe(1)
  })
})
