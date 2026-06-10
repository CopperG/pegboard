import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createChunkBuffer } from './chunk-buffer.mjs'

describe('createChunkBuffer', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('batches pushes within the interval into one flush', () => {
    const flush = vi.fn()
    const buf = createChunkBuffer(flush, 50)
    buf.push('a')
    buf.push('b')
    buf.push('c')
    expect(flush).not.toHaveBeenCalled()
    vi.advanceTimersByTime(50)
    expect(flush).toHaveBeenCalledTimes(1)
    expect(flush).toHaveBeenCalledWith('abc')
  })

  it('flushNow flushes pending text immediately and cancels timer', () => {
    const flush = vi.fn()
    const buf = createChunkBuffer(flush, 50)
    buf.push('x')
    buf.flushNow()
    expect(flush).toHaveBeenCalledWith('x')
    vi.advanceTimersByTime(100)
    expect(flush).toHaveBeenCalledTimes(1)
  })

  it('flushNow with empty buffer does not call flush', () => {
    const flush = vi.fn()
    const buf = createChunkBuffer(flush, 50)
    buf.flushNow()
    expect(flush).not.toHaveBeenCalled()
  })
})
