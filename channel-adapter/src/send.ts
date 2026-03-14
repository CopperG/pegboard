import {
  createReplyPrefixContext,
  type ClawdbotConfig,
  type ReplyPayload,
} from "openclaw/plugin-sdk";
import { getPegboardRuntime } from "./runtime.js";

// ---------------------------------------------------------------------------
// Shared WebSocket connection reference
// ---------------------------------------------------------------------------

let sharedWs: WebSocket | null = null;

/**
 * Store the active WebSocket connection so both monitor (inbound) and
 * send (outbound) share the same socket.
 */
export function setWsConnection(ws: WebSocket | null) {
  sharedWs = ws;
}

/**
 * Get the current WebSocket connection.
 */
export function getWsConnection(): WebSocket | null {
  return sharedWs;
}

/**
 * Send a JSON payload over the shared WebSocket.
 * Silently drops the message if the socket is not open.
 */
export function sendWsJson(payload: Record<string, unknown>) {
  if (!sharedWs || sharedWs.readyState !== sharedWs.OPEN) {
    return;
  }
  sharedWs.send(JSON.stringify(payload));
}

// ---------------------------------------------------------------------------
// Reply dispatcher (creates stream_start / stream_chunk / stream_end)
// ---------------------------------------------------------------------------

export interface CreatePegboardReplyDispatcherParams {
  cfg: ClawdbotConfig;
  agentId: string;
}

/**
 * Create a reply dispatcher that sends agent responses back to PegBoard
 * as streaming WS messages (stream_start -> stream_chunk* -> stream_end).
 */
export function createPegboardReplyDispatcher(params: CreatePegboardReplyDispatcherParams) {
  const core = getPegboardRuntime();
  const { cfg, agentId } = params;
  const prefixContext = createReplyPrefixContext({ cfg, agentId });

  // Stream session state — one session per dispatchReplyFromConfig call
  let currentMessageId = "";
  let streamStarted = false;     // true after first content sent
  let partialSentLength = 0;     // cumulative → delta tracking for onPartialReply

  /**
   * Lazily send stream_start on first actual content.
   * Prevents empty message bubbles from contentless reply cycles.
   */
  function ensureStreamStarted() {
    if (streamStarted) return;
    streamStarted = true;
    currentMessageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    sendWsJson({
      type: "stream_start",
      messageId: currentMessageId,
      timestamp: new Date().toISOString(),
    });
  }

  const { dispatcher, replyOptions, markDispatchIdle } =
    core.channel.reply.createReplyDispatcherWithTyping({
      responsePrefix: prefixContext.responsePrefix,
      responsePrefixContextProvider: prefixContext.responsePrefixContextProvider,
      humanDelay: core.channel.reply.resolveHumanDelayConfig(cfg, agentId),

      onReplyStart: () => {
        // Don't send stream_start here — defer to first content.
        // Just reset partial tracking for this reply cycle.
        partialSentLength = 0;
      },

      deliver: async (payload: ReplyPayload, _info) => {
        const text = payload.text ?? "";
        if (!text.trim()) return;

        // Only send what onPartialReply hasn't already sent
        const delta = partialSentLength > 0 ? text.slice(partialSentLength) : text;
        if (delta.length > 0) {
          ensureStreamStarted();
          sendWsJson({
            type: "stream_chunk",
            messageId: currentMessageId,
            content: delta,
          });
        }
        // Reset for next deliver call within same session
        partialSentLength = 0;
      },

      onError: async (error) => {
        const runtime = getPegboardRuntime();
        runtime.error?.(`pegboard: reply error: ${String(error)}`);

        if (streamStarted) {
          sendWsJson({
            type: "stream_end",
            messageId: currentMessageId,
            timestamp: new Date().toISOString(),
          });
        }
      },

      onIdle: async () => {
        // Only send stream_end if we actually started a stream
        if (streamStarted) {
          sendWsJson({
            type: "stream_end",
            messageId: currentMessageId,
            timestamp: new Date().toISOString(),
          });
        }
      },
    });

  return {
    dispatcher,
    replyOptions: {
      ...replyOptions,
      onModelSelected: prefixContext.onModelSelected,
      // onPartialReply receives cumulative text — convert to delta
      onPartialReply: (payload: ReplyPayload) => {
        const text = payload.text ?? "";
        if (text.length <= partialSentLength) return;

        const delta = text.slice(partialSentLength);
        partialSentLength = text.length;

        ensureStreamStarted();
        sendWsJson({
          type: "stream_chunk",
          messageId: currentMessageId,
          content: delta,
        });
      },
    },
    markDispatchIdle,
  };
}
