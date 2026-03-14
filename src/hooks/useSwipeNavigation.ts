import { useRef, useCallback, useEffect, useState } from 'react'

interface SwipeNavigationOptions {
  /** Minimum drag distance (px) to trigger a tab switch */
  threshold?: number
  /** Called when swiping to the previous tab. Return false if at boundary. */
  onPrev: () => boolean
  /** Called when swiping to the next tab. Return false if at boundary. */
  onNext: () => boolean
  enabled?: boolean
}

interface SwipeState {
  /** Current translateX offset in px (reactive, drives CSS transform) */
  offsetX: number
  /** Whether a transition animation is in progress */
  transitioning: boolean
  /** True while the pointer is down and the gesture is locked horizontal */
  dragging: boolean
  /** Which direction the user is dragging content ('left' = going to next, 'right' = going to prev) */
  direction: 'left' | 'right' | null
}

/**
 * Hook that detects horizontal pointer/touch drag on a container's empty space
 * and triggers prev/next navigation with a sliding transition.
 *
 * Returns refs and state to attach to the swipe container.
 */
export function useSwipeNavigation({
  threshold = 80,
  onPrev,
  onNext,
  enabled = true,
}: SwipeNavigationOptions) {
  const containerRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const startX = useRef(0)
  const startY = useRef(0)
  const locked = useRef<'horizontal' | 'vertical' | null>(null)
  const [state, setState] = useState<SwipeState>({ offsetX: 0, transitioning: false, dragging: false, direction: null })

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!enabled) return
      // Only trigger on primary button (left click / single touch)
      if (e.button !== 0) return
      // Only trigger when the target is the container itself or a non-interactive empty area
      const target = e.target as HTMLElement
      if (target.closest('[data-panel], .react-resizable-handle, .react-grid-item, button, a, input, textarea, [role="slider"], [data-no-swipe]')) return

      dragging.current = true
      locked.current = null
      startX.current = e.clientX
      startY.current = e.clientY
      setState({ offsetX: 0, transitioning: false, dragging: false, direction: null })
      // Capture pointer so we get move/up even if pointer leaves the container
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    },
    [enabled],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging.current) return
      const dx = e.clientX - startX.current
      const dy = e.clientY - startY.current

      // Lock direction after 10px of movement
      if (!locked.current && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
        locked.current = Math.abs(dx) >= Math.abs(dy) ? 'horizontal' : 'vertical'
      }

      if (locked.current !== 'horizontal') return

      // Apply resistance at boundaries (dampen by 0.3 beyond threshold)
      const maxDrag = threshold * 2.5
      let clamped = dx
      if (Math.abs(dx) > maxDrag) {
        const excess = Math.abs(dx) - maxDrag
        clamped = Math.sign(dx) * (maxDrag + excess * 0.3)
      }

      setState({ offsetX: clamped, transitioning: false, dragging: true, direction: clamped < 0 ? 'left' : clamped > 0 ? 'right' : null })
    },
    [threshold],
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging.current) return
      dragging.current = false
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)

      const dx = e.clientX - startX.current

      if (locked.current === 'horizontal' && Math.abs(dx) >= threshold) {
        // Natural direction: swipe left (negative dx) = next, swipe right = prev
        const navigated = dx < 0 ? onNext() : onPrev()
        if (navigated) {
          // Animate out in the swipe direction, then reset
          const containerWidth = containerRef.current?.offsetWidth ?? 400
          const exitX = dx < 0 ? -containerWidth : containerWidth
          setState({ offsetX: exitX, transitioning: true, dragging: false, direction: null })
          // After transition, snap to 0 instantly (new content slides in from opposite side)
          const timer = setTimeout(() => {
            // Brief flash from opposite side
            setState({ offsetX: dx < 0 ? containerWidth * 0.3 : -containerWidth * 0.3, transitioning: false, dragging: false, direction: null })
            requestAnimationFrame(() => {
              setState({ offsetX: 0, transitioning: true, dragging: false, direction: null })
              setTimeout(() => {
                setState({ offsetX: 0, transitioning: false, dragging: false, direction: null })
              }, 250)
            })
          }, 200)
          return () => clearTimeout(timer)
        }
      }

      // Snap back
      setState({ offsetX: 0, transitioning: true, dragging: false, direction: null })
      const timer = setTimeout(() => {
        setState({ offsetX: 0, transitioning: false, dragging: false, direction: null })
      }, 250)
      return () => clearTimeout(timer)
    },
    [threshold, onPrev, onNext],
  )

  // Reset offset when transitioning flag clears (e.g., if view changes externally)
  useEffect(() => {
    if (!enabled) {
      setState({ offsetX: 0, transitioning: false, dragging: false, direction: null })
    }
  }, [enabled])

  return {
    containerRef,
    swipeHandlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
    },
    swipeStyle: {
      transform: state.offsetX !== 0 ? `translateX(${state.offsetX}px)` : undefined,
      transition: state.transitioning ? 'transform 200ms ease-out' : undefined,
      willChange: dragging.current ? 'transform' as const : undefined,
    } as React.CSSProperties,
    /** True while pointer is down and gesture is locked horizontal */
    dragging: state.dragging,
    /** Drag direction: 'left' = content moving left (next view), 'right' = content moving right (prev view) */
    direction: state.direction,
    /** Normalised swipe progress 0..1 (ratio of current offset to threshold) */
    progress: Math.min(Math.abs(state.offsetX) / threshold, 1),
  }
}
