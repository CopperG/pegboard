import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { PanelSkeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/error-state'

// ── Active iframe limit tracking ──────────────────────────────────────

const MAX_IFRAMES = 5
const activeIframes = new Set<string>()
const listeners = new Set<() => void>()

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}

function notify() {
  for (const cb of listeners) cb()
}

function registerIframe(panelId: string): boolean {
  if (activeIframes.has(panelId)) return true
  if (activeIframes.size >= MAX_IFRAMES) return false
  activeIframes.add(panelId)
  notify()
  return true
}

function unregisterIframe(panelId: string) {
  if (activeIframes.delete(panelId)) {
    notify()
  }
}

function forceActivate(panelId: string) {
  const oldest = activeIframes.values().next().value
  if (oldest) {
    activeIframes.delete(oldest)
  }
  activeIframes.add(panelId)
  notify()
}

function useActiveIframeCount() {
  const [count, setCount] = useState(activeIframes.size)
  useEffect(() => {
    return subscribe(() => setCount(activeIframes.size))
  }, [])
  return count
}

// ── Persistent iframe layer ──────────────────────────────────────────
// Iframes live in a fixed overlay layer and are NEVER moved between DOM
// parents. WebKit reloads iframes on appendChild moves, so we keep each
// iframe in this layer permanently and position it over the panel slot
// using position:fixed + getBoundingClientRect syncing.

const iframeCache = new Map<string, { el: HTMLIFrameElement; srcHash: string }>()

let iframeLayer: HTMLDivElement | null = null

function getIframeLayer() {
  if (!iframeLayer) {
    iframeLayer = document.createElement('div')
    iframeLayer.id = 'sandbox-iframe-layer'
    iframeLayer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:1;'
    iframeLayer.setAttribute('aria-hidden', 'true')
    document.body.appendChild(iframeLayer)
  }
  return iframeLayer
}

/** Clean up the persistent iframe layer and all cached iframes */
export function cleanupIframeCache() {
  for (const [, entry] of iframeCache) {
    entry.el.remove()
  }
  iframeCache.clear()
  if (iframeLayer) {
    iframeLayer.remove()
    iframeLayer = null
  }
}

function hashSrc(html: string, css: string | undefined): string {
  const str = (html || '') + '|||' + (css || '')
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0
  }
  return h.toString(36)
}

// ── Theme variable injection for sandbox iframes ─────────────────────

const THEME_VAR_NAMES = [
  'background', 'foreground', 'card', 'card-foreground',
  'popover', 'popover-foreground', 'primary', 'primary-foreground',
  'secondary', 'secondary-foreground', 'muted', 'muted-foreground',
  'accent', 'accent-foreground', 'destructive', 'border', 'input', 'ring',
  'chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5', 'radius',
]

/**
 * Read current theme CSS variables from :root and serialize as a CSS block.
 * Uses --pg-* prefix to avoid colliding with the content's own CSS variables.
 * Also exposes --color-* aliases for Tailwind v4 template compatibility.
 */
function getThemeVarsCSS(): string {
  const style = getComputedStyle(document.documentElement)
  const vars: string[] = []
  for (const name of THEME_VAR_NAMES) {
    const value = style.getPropertyValue(`--${name}`).trim()
    if (value) {
      vars.push(`--pg-${name}: ${value};`)
      vars.push(`--color-${name}: ${value};`)
    }
  }
  return `:root { ${vars.join(' ')} }`
}

// ── SandboxRenderer ───────────────────────────────────────────────────

interface SandboxRendererProps {
  html: string
  css?: string
  panelId: string
}

export function SandboxRenderer({ html, css, panelId }: SandboxRendererProps) {
  const { t } = useTranslation('panels')
  const { resolved: resolvedTheme } = useTheme()
  const [state, setState] = useState<'loading' | 'ready' | 'timeout' | 'error'>('loading')
  const [showSource, setShowSource] = useState(false)
  const [iframeKey, setIframeKey] = useState(0)
  const [isActive, setIsActive] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const slotRef = useRef<HTMLDivElement>(null)

  const iframeCount = useActiveIframeCount()

  // Try to register this iframe on mount
  useEffect(() => {
    const registered = registerIframe(panelId)
    setIsActive(registered)
    return () => { unregisterIframe(panelId) }
  }, [panelId, iframeKey])

  // Check if we became active after another iframe was removed
  useEffect(() => {
    if (!isActive && activeIframes.has(panelId)) {
      setIsActive(true)
    }
  }, [iframeCount, isActive, panelId])

  // Read theme CSS variables (reactive to theme changes via resolvedTheme)
  const themeVarsCSS = useMemo(() => getThemeVarsCSS(), [resolvedTheme])

  const srcdoc = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:;">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    ${themeVarsCSS}
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; background: transparent; }
    ${css || ''}
  </style>
</head>
<body>${html}</body>
</html>`

  const currentHash = hashSrc(html, css + themeVarsCSS)

  // Create/reuse iframe in persistent layer + sync position over slot
  useEffect(() => {
    if (!isActive || !slotRef.current) return

    const slot = slotRef.current
    const layer = getIframeLayer()
    const cached = iframeCache.get(panelId)
    let iframe: HTMLIFrameElement

    if (cached && cached.srcHash === currentHash) {
      // Reuse existing iframe — just show it (no DOM move!)
      iframe = cached.el
      iframe.style.visibility = 'visible'
      iframe.style.opacity = '1'
      setState('ready')
    } else {
      // Content changed or no cache — create fresh iframe
      if (cached) {
        cached.el.remove()
        iframeCache.delete(panelId)
      }

      iframe = document.createElement('iframe')
      iframe.sandbox.add('allow-scripts')
      iframe.srcdoc = srcdoc
      iframe.title = `sandbox-${panelId}`
      iframe.style.cssText = 'position:fixed;border:0;border-radius:0.5rem;pointer-events:auto;visibility:hidden;opacity:0;transition:opacity 0.3s;'

      iframe.onload = () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
          timeoutRef.current = null
        }
        iframe.style.opacity = '1'
        iframe.style.visibility = 'visible'
        setState('ready')
      }
      iframe.onerror = () => setState('error')

      layer.appendChild(iframe)
      iframeCache.set(panelId, { el: iframe, srcHash: currentHash })
      setState('loading')
    }

    // Sync iframe position with slot element
    let lastL = 0, lastT = 0, lastW = 0, lastH = 0

    const syncPosition = () => {
      const rect = slot.getBoundingClientRect()
      if (rect.left === lastL && rect.top === lastT && rect.width === lastW && rect.height === lastH) return
      lastL = rect.left; lastT = rect.top; lastW = rect.width; lastH = rect.height
      iframe.style.left = `${rect.left}px`
      iframe.style.top = `${rect.top}px`
      iframe.style.width = `${rect.width}px`
      iframe.style.height = `${rect.height}px`
    }

    syncPosition()

    const ro = new ResizeObserver(syncPosition)
    ro.observe(slot)

    // rAF loop catches position changes from grid layout reflow / scroll
    let rafId: number
    const rafLoop = () => {
      syncPosition()
      rafId = requestAnimationFrame(rafLoop)
    }
    rafId = requestAnimationFrame(rafLoop)

    return () => {
      // Hide iframe — do NOT remove or move it
      iframe.style.visibility = 'hidden'
      iframe.style.left = '-9999px'
      iframe.style.opacity = '0'
      ro.disconnect()
      cancelAnimationFrame(rafId)
    }
  }, [isActive, panelId, currentHash, iframeKey])

  // Load timeout
  useEffect(() => {
    if (!isActive || state !== 'loading') return

    timeoutRef.current = setTimeout(() => {
      setState('timeout')
    }, 5000)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [isActive, state, iframeKey])

  const handleReload = useCallback(() => {
    const cached = iframeCache.get(panelId)
    if (cached) {
      cached.el.remove()
      iframeCache.delete(panelId)
    }
    setState('loading')
    setShowSource(false)
    setIframeKey((k) => k + 1)
  }, [panelId])

  const handleForceActivate = useCallback(() => {
    forceActivate(panelId)
    setIsActive(true)
    setState('loading')
    setIframeKey((k) => k + 1)
  }, [panelId])

  // Over limit: show placeholder
  if (!isActive) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 text-muted-foreground h-full"
      >
        <span className="text-sm">{t('iframe_limit')}</span>
        <button
          type="button"
          onClick={handleForceActivate}
          className="text-xs text-primary hover:underline cursor-pointer focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none rounded"
          aria-label={t('click_to_load')}
        >
          {t('click_to_load')}
        </button>
      </div>
    )
  }

  // Timeout / error state
  if (state === 'timeout' || state === 'error') {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 h-full"
      >
        <ErrorState
          title={state === 'timeout' ? t('load_timeout') : t('load_failed')}
          retryAction={handleReload}
          retryLabel={t('reload')}
          className="p-3"
        />
        <button
          type="button"
          onClick={() => setShowSource((v) => !v)}
          className="text-xs text-primary hover:underline cursor-pointer focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none rounded"
        >
          {showSource ? t('hide_source') : t('show_source')}
        </button>
        {showSource && (
          <pre className="mt-2 max-h-48 w-full overflow-auto rounded bg-muted p-3 text-xs text-foreground font-mono whitespace-pre-wrap break-all border border-border/20">
            {srcdoc}
          </pre>
        )}
      </div>
    )
  }

  return (
    <div className="relative h-full">
      {/* Loading skeleton */}
      {state === 'loading' && (
        <div className="absolute inset-0">
          <PanelSkeleton type="text" />
        </div>
      )}

      {/* Invisible slot — iframe overlays this via position:fixed */}
      <div ref={slotRef} className="w-full h-full" />
    </div>
  )
}
