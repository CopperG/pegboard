import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import type { ClawdbotConfig } from "openclaw/plugin-sdk";
import { DEFAULT_ACCOUNT_ID } from "openclaw/plugin-sdk";

// ---------------------------------------------------------------------------
// WS Token
// ---------------------------------------------------------------------------

export interface WsTokenConfig {
  token: string;
  port: number;
}

const WS_TOKEN_PATH = join(homedir(), ".pegboard", "config", "ws-token.json");

/**
 * Read the WS authentication token from ~/.lobster-pegboard/config/ws-token.json.
 * Throws if the file is missing or malformed.
 */
export async function readWsToken(): Promise<WsTokenConfig> {
  const raw = await readFile(WS_TOKEN_PATH, "utf-8");
  const parsed = JSON.parse(raw) as { token?: string; port?: number };

  if (!parsed.token || typeof parsed.token !== "string") {
    throw new Error(`Invalid ws-token.json: missing or invalid "token" field`);
  }

  return {
    token: parsed.token,
    port: parsed.port ?? 9800,
  };
}

/**
 * Build the WebSocket URL from token config.
 */
export function buildWsUrl(tokenCfg: WsTokenConfig): string {
  return `ws://localhost:${tokenCfg.port}?token=${tokenCfg.token}`;
}

// ---------------------------------------------------------------------------
// Account resolution (single default account, always configured)
// ---------------------------------------------------------------------------

export interface ResolvedPegboardAccount {
  accountId: string;
  enabled: boolean;
  configured: boolean;
}

/**
 * Resolve the single PegBoard account.
 * PegBoard uses a single default account; it is "configured" when the
 * ws-token.json file exists (checked lazily at connect time, not here).
 */
export function resolvePegboardAccount(
  _cfg: ClawdbotConfig,
  _accountId?: string | null,
): ResolvedPegboardAccount {
  const pegboardCfg = (_cfg.channels as Record<string, any> | undefined)?.["lobster-pegboard"];
  const enabled = pegboardCfg?.enabled !== false;

  return {
    accountId: DEFAULT_ACCOUNT_ID,
    enabled,
    configured: true, // actual connectivity is validated at monitor start
  };
}
