import type { ClawdbotConfig } from "openclaw/plugin-sdk";
import { DEFAULT_ACCOUNT_ID } from "openclaw/plugin-sdk";
import { getPegboardRuntime } from "./runtime.js";
import { createPegboardReplyDispatcher } from "./send.js";

// ---------------------------------------------------------------------------
// Inbound message types (from PegBoard frontend)
// ---------------------------------------------------------------------------

export interface PegboardCanvasState {
  pinnedPanels: unknown[];
  transientPanels: unknown[];
  layoutMode: string;
  archivedCount: number;
}

export interface PegboardReferencedPanel {
  panelId: string;
  title: string;
  panelType: string;
}

export interface PegboardUserMessage {
  type: "user_message";
  content: string;
  canvasState: PegboardCanvasState;
  referencedPanels?: PegboardReferencedPanel[];
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Handle inbound user message
// ---------------------------------------------------------------------------

export interface HandlePegboardMessageParams {
  cfg: ClawdbotConfig;
  content: string;
  canvasState?: PegboardCanvasState;
  referencedPanels?: PegboardReferencedPanel[];
  timestamp: string;
}

/**
 * Handle an inbound user_message from PegBoard:
 * 1. Resolve agent route
 * 2. Enqueue system event
 * 3. Finalize inbound context
 * 4. Create reply dispatcher (sends stream_start/chunk/end back via WS)
 * 5. Dispatch to agent
 */
export async function handlePegboardMessage(params: HandlePegboardMessageParams): Promise<void> {
  const core = getPegboardRuntime();
  const { cfg, content, canvasState, referencedPanels, timestamp } = params;

  const log = core.log ?? console.log;
  const error = core.error ?? console.error;

  try {
    // 1. Resolve agent route
    const route = core.channel.routing.resolveAgentRoute({
      cfg,
      channel: "lobster-pegboard",
      accountId: DEFAULT_ACCOUNT_ID,
      peer: { kind: "direct", id: "pegboard-user" },
    });

    // 2. Build message body with context
    let messageBody = content;

    // Append referenced panels context if present
    if (referencedPanels && referencedPanels.length > 0) {
      const refs = referencedPanels
        .map((p) => `  - [${p.panelType}] ${p.title} (${p.panelId})`)
        .join("\n");
      messageBody += `\n\n[Referenced panels:\n${refs}]`;
    }

    // Append canvas state with panel list so agent can reference panelIds
    if (canvasState) {
      const lines: string[] = [];
      lines.push(`layout: ${canvasState.layoutMode}, archived: ${canvasState.archivedCount}`);

      const pinned = canvasState.pinnedPanels as { id?: string; type?: string; title?: string; size?: string }[];
      const transient = canvasState.transientPanels as { id?: string; type?: string; title?: string }[];

      for (const p of pinned) {
        lines.push(`  📌 [${p.type}] "${p.title}" (id: ${p.id}, size: ${p.size})`);
      }
      for (const p of transient) {
        lines.push(`  · [${p.type}] "${p.title}" (id: ${p.id})`);
      }

      if (pinned.length === 0 && transient.length === 0) {
        lines.push("  (empty canvas)");
      }

      messageBody += `\n\n[Canvas state:\n${lines.join("\n")}]`;
    }

    // 3. Enqueue system event
    const preview = content.replace(/\s+/g, " ").slice(0, 160);
    core.system.enqueueSystemEvent(`PegBoard message: ${preview}`, {
      sessionKey: route.sessionKey,
      contextKey: `pegboard:message:${Date.now()}`,
    });

    // 4. Format envelope and finalize inbound context
    const envelopeOptions = core.channel.reply.resolveEnvelopeFormatOptions(cfg);
    const body = core.channel.reply.formatAgentEnvelope({
      channel: "PegBoard",
      from: "pegboard-user",
      timestamp: new Date(timestamp),
      envelope: envelopeOptions,
      body: messageBody,
    });

    const ctxPayload = core.channel.reply.finalizeInboundContext({
      Body: body,
      RawBody: content,
      CommandBody: content,
      From: "pegboard:user",
      To: "pegboard:canvas",
      SessionKey: route.sessionKey,
      AccountId: route.accountId,
      ChatType: "direct",
      SenderName: "用户",
      SenderId: "pegboard-user",
      Provider: "lobster-pegboard" as const,
      Surface: "lobster-pegboard" as const,
      MessageSid: `pb-${Date.now()}`,
      Timestamp: Date.now(),
      WasMentioned: true,
      CommandAuthorized: true,
      OriginatingChannel: "lobster-pegboard" as const,
      OriginatingTo: "pegboard:canvas",
    });

    // 5. Create reply dispatcher
    const { dispatcher, replyOptions, markDispatchIdle } = createPegboardReplyDispatcher({
      cfg,
      agentId: route.agentId,
    });

    log(`pegboard: dispatching to agent (session=${route.sessionKey})`);

    // 6. Dispatch to agent
    const { queuedFinal, counts } = await core.channel.reply.dispatchReplyFromConfig({
      ctx: ctxPayload,
      cfg,
      dispatcher,
      replyOptions,
    });

    markDispatchIdle();

    log(`pegboard: dispatch complete (queuedFinal=${queuedFinal}, replies=${counts.final})`);
  } catch (err) {
    error(`pegboard: failed to dispatch message: ${String(err)}`);
  }
}
