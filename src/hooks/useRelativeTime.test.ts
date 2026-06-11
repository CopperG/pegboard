import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRelativeTime } from '@/hooks/useRelativeTime'

describe('useRelativeTime', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns Chinese relative time and an absolute time', () => {
    const threeMinAgo = new Date(Date.now() - 3 * 60 * 1000).toISOString()
    const { result } = renderHook(() => useRelativeTime(threeMinAgo))
    expect(result.current.relative).toMatch(/分钟前/)
    expect(result.current.absolute.length).toBeGreaterThan(0)
  })

  it('returns empty strings for invalid input', () => {
    expect(renderHook(() => useRelativeTime('not-a-date')).result.current.relative).toBe('')
    expect(renderHook(() => useRelativeTime(undefined)).result.current.relative).toBe('')
  })

  it('recomputes when the refresh timer fires', () => {
    vi.useFakeTimers()
    const start = Date.now()
    const fiftySecAgo = new Date(start - 50 * 1000).toISOString()
    const { result } = renderHook(() => useRelativeTime(fiftySecAgo))
    const first = result.current.relative
    act(() => {
      vi.advanceTimersByTime(61 * 1000)
    })
    expect(result.current.relative).not.toBe(first)
  })
})
