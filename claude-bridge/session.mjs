import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'

export const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000

export function sessionPath() {
  return join(homedir(), '.pegboard', 'config', 'claude-session.json')
}

/** Pure: a stored session is resumable when fresh (< 24h) and well-formed. */
export function isResumable(stored, now, maxAgeMs = SESSION_MAX_AGE_MS) {
  if (!stored || typeof stored !== 'object') return false
  if (typeof stored.sessionId !== 'string' || stored.sessionId === '') return false
  if (typeof stored.updatedAt !== 'number') return false
  const age = now - stored.updatedAt
  return age >= 0 && age < maxAgeMs
}

export async function loadSession(now = Date.now()) {
  try {
    const raw = await readFile(sessionPath(), 'utf-8')
    const stored = JSON.parse(raw)
    return isResumable(stored, now) ? stored.sessionId : null
  } catch {
    return null
  }
}

export async function saveSession(sessionId, now = Date.now()) {
  try {
    const p = sessionPath()
    await mkdir(dirname(p), { recursive: true })
    await writeFile(p, JSON.stringify({ sessionId, updatedAt: now }))
  } catch {
    // Non-fatal: losing the session file only loses cross-restart memory.
  }
}
