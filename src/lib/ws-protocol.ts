import { z } from 'zod/v4'
import type { WebSocketMessage } from '@/types/websocket'

const VALID_TYPES = [
  'response', 'panel_action', 'stream_start', 'stream_chunk', 'stream_end',
  'canvas_control', 'app_control', 'realtime_control',
  'canvas_state_response', 'panel_detail_response',
] as const

const WsMessageBaseSchema = z.object({
  type: z.enum(VALID_TYPES),
}).passthrough()

/** Maximum allowed raw message size (16 MB) */
const MAX_MESSAGE_SIZE = 16 * 1024 * 1024

export function deserializeMessage(raw: string): WebSocketMessage | null {
  try {
    // Check payload size before parsing
    if (raw.length > MAX_MESSAGE_SIZE) {
      console.warn(
        `[ws-protocol] Message rejected: size ${raw.length} exceeds max ${MAX_MESSAGE_SIZE}`,
      )
      return null
    }

    const parsed = JSON.parse(raw)

    // Validate message structure with Zod
    const result = WsMessageBaseSchema.safeParse(parsed)
    if (!result.success) {
      console.warn(
        '[ws-protocol] Message validation failed:',
        result.error.issues,
      )
      return null
    }

    return result.data as unknown as WebSocketMessage
  } catch {
    return null
  }
}
