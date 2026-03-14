import type { ClawdbotConfig, RuntimeEnv } from "openclaw/plugin-sdk";
import { readWsToken, buildWsUrl } from "./config.js";
import { setWsConnection } from "./send.js";
import { handlePegboardMessage, type PegboardUserMessage } from "./bot.js";

// ---------------------------------------------------------------------------
// Monitor options
// ---------------------------------------------------------------------------

export interface MonitorPegboardOpts {
  config?: ClawdbotConfig;
  runtime?: RuntimeEnv;
  abortSignal?: AbortSignal;
  accountId?: string;
}

// ---------------------------------------------------------------------------
// Reconnect constants (exponential backoff)
// ---------------------------------------------------------------------------

const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;
const RECONNECT_MULTIPLIER = 2;

function clampDelay(attempt: number): number {
  const delay = RECONNECT_BASE_MS * Math.pow(RECONNECT_MULTIPLIER, attempt);
  return Math.min(delay, RECONNECT_MAX_MS);
}

// ---------------------------------------------------------------------------
// Validate inbound message
// ---------------------------------------------------------------------------

function isUserMessage(msg: unknown): msg is PegboardUserMessage {
  if (!msg || typeof msg !== "object") return false;
  const m = msg as Record<string, unknown>;
  return m.type === "user_message" && typeof m.content === "string";
}

// ---------------------------------------------------------------------------
// Main monitor loop
// ---------------------------------------------------------------------------

/**
 * Establish a persistent WebSocket connection to PegBoard's WS server
 * (localhost:9800) with auto-reconnect and exponential backoff.
 *
 * Listens for `user_message` type only; dispatches to handlePegboardMessage.
 */
export async function monitorPegboard(opts: MonitorPegboardOpts = {}): Promise<void> {
  const { config: cfg, runtime, abortSignal } = opts;

  if (!cfg) {
    throw new Error("Config is required for PegBoard monitor");
  }

  const log = runtime?.log ?? console.log;
  const error = runtime?.error ?? console.error;

  let attempt = 0;

  while (!abortSignal?.aborted) {
    let ws: WebSocket | null = null;

    try {
      // Read token on each attempt (file may be regenerated)
      const tokenCfg = await readWsToken();
      const url = buildWsUrl(tokenCfg);

      log(`pegboard: connecting to ${url.replace(/token=.*/, "token=***")} (attempt ${attempt + 1})`);

      ws = new WebSocket(url);

      await new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          setWsConnection(null);
        };

        const handleAbort = () => {
          log("pegboard: abort signal received, closing WebSocket");
          cleanup();
          ws?.close();
          resolve();
        };

        if (abortSignal?.aborted) {
          cleanup();
          resolve();
          return;
        }

        abortSignal?.addEventListener("abort", handleAbort, { once: true });

        ws!.onopen = () => {
          log("pegboard: connected to ws://localhost:" + tokenCfg.port);
          attempt = 0; // reset backoff on successful connection
          setWsConnection(ws);
        };

        ws!.onmessage = (event: MessageEvent) => {
          try {
            const raw = typeof event.data === "string" ? event.data : String(event.data);
            const msg = JSON.parse(raw);

            // Only process user_message, ignore all other broadcast messages
            if (!isUserMessage(msg)) {
              return;
            }

            log(`pegboard: received user_message (len=${msg.content.length})`);

            handlePegboardMessage({
              cfg,
              content: msg.content,
              canvasState: msg.canvasState,
              referencedPanels: msg.referencedPanels,
              timestamp: msg.timestamp,
            }).catch((err) => {
              error(`pegboard: handlePegboardMessage error: ${String(err)}`);
            });
          } catch (err) {
            error(`pegboard: failed to parse WS message: ${String(err)}`);
          }
        };

        ws!.onclose = (event: CloseEvent) => {
          log(`pegboard: WebSocket closed (code=${event.code}, reason=${event.reason || "none"})`);
          cleanup();
          abortSignal?.removeEventListener("abort", handleAbort);
          resolve();
        };

        ws!.onerror = (event: Event) => {
          error(`pegboard: WebSocket error`);
          cleanup();
          abortSignal?.removeEventListener("abort", handleAbort);
          // Don't reject — let onclose handle the resolution so we reconnect
        };
      });
    } catch (err) {
      error(`pegboard: connection error: ${String(err)}`);
      setWsConnection(null);
    }

    // Don't reconnect if we were asked to stop
    if (abortSignal?.aborted) {
      break;
    }

    // Exponential backoff
    const delay = clampDelay(attempt);
    log(`pegboard: reconnecting in ${delay}ms (attempt ${attempt + 1})`);
    attempt++;

    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, delay);
      const onAbort = () => {
        clearTimeout(timer);
        resolve();
      };
      abortSignal?.addEventListener("abort", onAbort, { once: true });
    });
  }

  log("pegboard: monitor stopped");
}
