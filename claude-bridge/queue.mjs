/**
 * Single-flight turn queue: only one claude turn runs at a time,
 * later messages wait. Bounded so impatient re-sends cannot pile up
 * unbounded serial turns.
 */
export function createTurnQueue({ capacity = 10, onOverflow } = {}) {
  const items = []
  let active = false
  return {
    push(item) {
      if (items.length >= capacity) {
        onOverflow?.(item)
        return false
      }
      items.push(item)
      return true
    },
    /** Returns the next item and marks the queue active, or null. */
    next() {
      if (active || items.length === 0) return null
      active = true
      return items.shift()
    },
    /** Marks the current turn finished. */
    done() {
      active = false
    },
    get pending() {
      return items.length
    },
    get isActive() {
      return active
    },
  }
}
