import { useRef, useEffect, useCallback, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { invoke } from '@tauri-apps/api/core'
import { useCanvasStore } from '@/stores/canvas-store'
import { useConnectionStore } from '@/stores/connection-store'
import { GridLayout } from './GridLayout'
import { PanelShell } from '@/components/panels/PanelShell'
import { resolveRenderer, initRegistry } from '@/components/panels/PanelRegistry'
import { SandboxRenderer } from '@/components/panels/SandboxRenderer'
import type { PanelState } from '@/types/store'
import type { CanvasView } from '@/types/layout'
import { CATEGORY_TAGS } from '@/types/layout'

// ── Registry initialization (once) ──────────────────────────────────

let registryInitialized = false

function ensureRegistry() {
  if (!registryInitialized) {
    initRegistry()
    registryInitialized = true
  }
}

// ── Panel renderer ──────────────────────────────────────────────────

function RenderPanel({ panel }: { panel: PanelState }) {
  const isFocused = panel.focused ?? false
  const result = resolveRenderer(panel)

  return (
    <PanelShell
      panelId={panel.panelId}
      title={panel.title}
      subtitle={panel.subtitle}
      size={panel.size}
      pinned={panel.pinned}
      focused={isFocused}
      isHtmlPanel={result.type === 'sandbox'}
      panelType={panel.panelType}
    >
      {result.type === 'sandbox' ? (
        <SandboxRenderer
          html={result.html}
          css={result.css}
          panelId={panel.panelId}
        />
      ) : (
        <Suspense fallback={<div className="animate-pulse bg-muted/50 rounded-lg h-full min-h-[100px]" />}>
          <result.component panelId={panel.panelId} data={panel.data} size={panel.size} />
        </Suspense>
      )}
    </PanelShell>
  )
}

// ── Filter panels by view (tag-based) ───────────────────────────────

function filterPanels(panels: PanelState[], view: CanvasView): PanelState[] {
  if (view === 'all') return panels
  if (view === 'other') {
    // "other" shows panels with no category tags or explicitly tagged "other"
    const categoryTagValues = Object.values(CATEGORY_TAGS)
    return panels.filter((p) => {
      if (!p.tags || p.tags.length === 0) return true
      if (p.tags.includes('other')) return true
      // Show if panel has no recognized category tags
      return !p.tags.some((t) => categoryTagValues.includes(t))
    })
  }
  const tag = CATEGORY_TAGS[view]
  return panels.filter((p) => p.tags?.includes(tag))
}

// ── i18n keys per view ──────────────────────────────────────────────

const VIEW_LABEL_KEYS: Record<CanvasView, string> = {
  important: 'important',
  daily: 'daily',
  work: 'work',
  entertainment: 'entertainment',
  other: 'other',
  all: 'all',
}

// ── Canvas (root) ───────────────────────────────────────────────────

function EmptyCanvasWelcome() {
  const { t } = useTranslation('canvas')
  const wsStatus = useConnectionStore((s) => s.status)

  const handleRetry = useCallback(() => {
    invoke('get_ws_status').catch(console.error)
  }, [])

  if (wsStatus === 'disconnected') {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center gap-4 text-center text-pretty">
        <div className="text-lg text-muted-foreground">
          {t('waiting_connection')}
        </div>
        <div className="text-sm text-muted-foreground/70">
          {t('ensure_openclaw')}
        </div>
        <button
          onClick={handleRetry}
          className="mt-2 px-4 py-2 text-sm rounded-md border border-border bg-muted hover:bg-muted/50 transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          {t('retry_connection')}
        </button>
      </div>
    )
  }

  return (
    <div className="h-full w-full flex items-center justify-center text-muted-foreground text-sm">
      {t('no_panels')}
    </div>
  )
}

export function Canvas() {
  const { t } = useTranslation('canvas')
  const activeView = useCanvasStore((s) => s.activeView)
  const panels = useCanvasStore((s) => s.panels)
  const focusedId = useCanvasStore(
    (s) => s.panels.find((p) => p.focused)?.panelId ?? null,
  )
  const initRef = useRef(false)

  useEffect(() => {
    if (!initRef.current) {
      ensureRegistry()
      initRef.current = true
    }
  }, [])

  const filteredPanels = filterPanels(panels, activeView)
  const viewLabel = t(VIEW_LABEL_KEYS[activeView])

  // Empty state
  if (filteredPanels.length === 0) {
    if (activeView === 'all' && panels.length === 0) {
      return <EmptyCanvasWelcome />
    }
    const emptyMsg = activeView === 'all'
      ? t('no_panels')
      : t('no_category_panels')
    return (
      <div className="h-full w-full flex items-center justify-center text-muted-foreground text-sm" role="tabpanel" aria-label={viewLabel}>
        {emptyMsg}
      </div>
    )
  }

  return (
    <div className="h-full w-full overflow-auto" role="tabpanel" aria-label={viewLabel}>
      <GridLayout panels={filteredPanels}>
        {filteredPanels.map((panel) => (
          <div
            key={panel.panelId}
            className={focusedId && focusedId !== panel.panelId ? 'opacity-40 transition-opacity duration-300' : 'transition-opacity duration-300'}
          >
            <RenderPanel panel={panel} />
          </div>
        ))}
      </GridLayout>
    </div>
  )
}
