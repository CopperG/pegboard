import type { ChannelPlugin } from "openclaw/plugin-sdk";
import { DEFAULT_ACCOUNT_ID } from "openclaw/plugin-sdk";
import type { ResolvedPegboardAccount } from "./config.js";
import { resolvePegboardAccount } from "./config.js";
import { sendWsJson, getWsConnection } from "./send.js";
import { getPegboardRuntime } from "./runtime.js";

export const pegboardPlugin: ChannelPlugin<ResolvedPegboardAccount> = {
  id: "lobster-pegboard",
  meta: {
    id: "lobster-pegboard",
    label: "Lobster PegBoard",
    selectionLabel: "Lobster PegBoard (龙虾洞洞板)",
    blurb: "Lobster PegBoard desktop canvas channel.",
    order: 90,
  },
  capabilities: {
    chatTypes: ["direct"],
    polls: false,
    threads: false,
    media: false,
    reactions: false,
    edit: false,
    reply: false,
  },
  config: {
    listAccountIds: () => [DEFAULT_ACCOUNT_ID],
    resolveAccount: (cfg, accountId) => resolvePegboardAccount(cfg, accountId),
    defaultAccountId: () => DEFAULT_ACCOUNT_ID,
    isConfigured: (account) => account.configured,
    describeAccount: (account) => ({
      accountId: account.accountId,
      enabled: account.enabled,
      configured: account.configured,
    }),
  },
  outbound: {
    deliveryMode: "direct",
    textChunkLimit: 4000,
    sendText: async ({ cfg, to, text, accountId }) => {
      const ws = getWsConnection();
      if (!ws || ws.readyState !== ws.OPEN) {
        throw new Error("PegBoard WebSocket not connected");
      }

      // Send as a full response (non-streaming) via WS
      sendWsJson({
        type: "response",
        chatMessage: text,
        timestamp: new Date().toISOString(),
      });

      return { channel: "lobster-pegboard" };
    },
  },
  gateway: {
    startAccount: async (ctx) => {
      const { monitorPegboard } = await import("./monitor.js");
      ctx.log?.info?.(`starting lobster-pegboard[${ctx.accountId}]`);
      return monitorPegboard({
        config: ctx.cfg,
        runtime: ctx.runtime,
        abortSignal: ctx.abortSignal,
        accountId: ctx.accountId,
      });
    },
  },
  status: {
    defaultRuntime: {
      accountId: DEFAULT_ACCOUNT_ID,
      running: false,
      lastStartAt: null,
      lastStopAt: null,
      lastError: null,
      port: null,
    },
    buildChannelSummary: ({ snapshot }) => ({
      configured: snapshot.configured ?? false,
      running: snapshot.running ?? false,
      lastStartAt: snapshot.lastStartAt ?? null,
      lastStopAt: snapshot.lastStopAt ?? null,
      lastError: snapshot.lastError ?? null,
    }),
    buildAccountSnapshot: ({ account, runtime }) => ({
      accountId: account.accountId,
      enabled: account.enabled,
      configured: account.configured,
      running: runtime?.running ?? false,
      lastStartAt: runtime?.lastStartAt ?? null,
      lastStopAt: runtime?.lastStopAt ?? null,
      lastError: runtime?.lastError ?? null,
    }),
  },
};
