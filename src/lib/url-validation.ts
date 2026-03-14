// Shared URL & path validation utilities for SSRF prevention (adapters layer)

const BLOCKED_HOSTS = ['127.0.0.1', 'localhost', '0.0.0.0', '::1', '[::1]']
const PRIVATE_IP_PATTERNS = [
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./, // link-local
  /^fc00:/i, // IPv6 ULA
  /^fe80:/i, // IPv6 link-local
]

export function isPrivateHost(hostname: string): boolean {
  if (BLOCKED_HOSTS.includes(hostname)) return true
  return PRIVATE_IP_PATTERNS.some((p) => p.test(hostname))
}

/**
 * Validates that a URL is safe for external WebSocket connections.
 * Blocks private/internal IPs to prevent SSRF.
 */
export function isValidExternalWsUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (!['ws:', 'wss:'].includes(parsed.protocol)) return false
    return !isPrivateHost(parsed.hostname)
  } catch {
    return false
  }
}

/**
 * Validates that a URL is safe for external HTTP polling.
 * Blocks private/internal IPs to prevent SSRF.
 */
export function isValidExternalHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) return false
    return !isPrivateHost(parsed.hostname)
  } catch {
    return false
  }
}

/**
 * Validates that a file path doesn't reference sensitive system files.
 * Blocks directory traversal and known sensitive paths.
 */
export function isValidFilePath(path: string): boolean {
  if (!path || path.includes('..')) return false
  const blocked = [
    '.ssh',
    '.gnupg',
    '.aws',
    '.env',
    '/etc/',
    '/proc/',
    '/sys/',
    '/dev/',
    'shadow',
    'passwd',
    '.credentials',
    'id_rsa',
    'id_ed25519',
  ]
  const lower = path.toLowerCase()
  return !blocked.some((b) => lower.includes(b))
}
