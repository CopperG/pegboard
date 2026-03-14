import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { CanvasStore, PanelState, ArchivedPanel, PanelLayoutPosition } from '@/types/store'
import type {
  PanelMessage,
  JsonPatchOperation,
} from '@/types/panel-protocol'
import type { LayoutMode, CanvasView } from '@/types/layout'
import type { CanvasStateSnapshot, PanelSummary } from '@/types/websocket'
import { BUILTIN_THEMES } from '@/hooks/useTheme'
import { DEFAULT_GRID_CONFIG, CATEGORY_TAGS, CANVAS_VIEW_ORDER } from '@/types/layout'
import { applyJsonPatch, validatePatchSafety } from '@/lib/json-patch'
import { validatePanelData } from '@/lib/panel-validators'
import type { Operation } from 'fast-json-patch'

const AVAILABLE_PLUGINS = [
  'text',
  'table',
  'list',
  'chart',
  'code',
  'image',
  'timeline',
  'kv',
] as const

/** Convert our JsonPatchOperation[] to fast-json-patch Operation[] */
function toFastJsonPatchOps(patch: JsonPatchOperation[]): Operation[] {
  return patch as unknown as Operation[]
}

/** Validate panelId: max 128 chars, alphanumeric + hyphens + underscores only */
function validatePanelId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{1,128}$/.test(id)
}

/** Validate panel string properties for length limits */
function validatePanelProperties(message: { panelId: string; title?: string; subtitle?: string }): string | null {
  if (!validatePanelId(message.panelId)) {
    return `Invalid panelId "${message.panelId}": must be 1-128 alphanumeric/hyphen/underscore chars`
  }
  if (message.title !== undefined && message.title.length > 500) {
    return `Panel title too long (${message.title.length} chars, max 500)`
  }
  if (message.subtitle !== undefined && message.subtitle.length > 500) {
    return `Panel subtitle too long (${message.subtitle.length} chars, max 500)`
  }
  return null
}

/** Generate a short data summary for canvasState snapshot */
function summarizeData(data: unknown): string | undefined {
  if (data == null) return undefined
  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>
    // Table: count rows + column names
    if (Array.isArray(obj['rows'])) {
      const cols = Array.isArray(obj['columns'])
        ? (obj['columns'] as { label?: string }[]).map((c) => c.label || '?').join(', ')
        : ''
      return cols ? `${obj['rows'].length} rows [${cols}]` : `${obj['rows'].length} rows`
    }
    // List or KV: both have items[] — distinguish by field shape
    if (Array.isArray(obj['items'])) {
      const items = obj['items'] as Record<string, unknown>[]
      const count = items.length
      // KV items have 'key' field, list items have 'title' field
      if (count > 0 && 'key' in items[0]!) {
        // KV panel: preview key=value pairs
        const preview = items
          .slice(0, 3)
          .map((i) => `${i.key}=${i.value}`)
          .join(', ')
        const suffix = count > 3 ? ', ...' : ''
        return `${count} kv: ${preview}${suffix}`
      }
      // List panel: preview item titles
      const preview = items
        .slice(0, 3)
        .map((i) => (i.title as string) || '?')
        .join(', ')
      const suffix = count > 3 ? ', ...' : ''
      return `${count} items: ${preview}${suffix}`
    }
    // Timeline: count events + preview first 3 titles
    if (Array.isArray(obj['events'])) {
      const events = obj['events'] as { title?: string }[]
      const count = events.length
      const preview = events
        .slice(0, 3)
        .map((e) => e.title || '?')
        .join(', ')
      const suffix = count > 3 ? ', ...' : ''
      return `${count} events: ${preview}${suffix}`
    }
    // Text: word count or summary
    if (typeof obj['summary'] === 'string') {
      return obj['summary'] as string
    }
    // Code: language + filename
    if (typeof obj['language'] === 'string') {
      const lang = obj['language'] as string
      const filename = obj['filename'] as string | undefined
      return filename ? `${lang}: ${filename}` : lang
    }
    // Chart: chart type
    if (typeof obj['chartType'] === 'string') {
      return obj['chartType'] as string
    }
  }
  return undefined
}

/** Quick data-shape check matching what panel components' runtime guards test.
 *  Returns a short error string if data won't render, or undefined if OK. */
function detectRenderError(panelType: string, data: unknown): string | undefined {
  // html panels don't use structured data
  if (panelType === 'html' || panelType === '_fallback') return undefined
  if (data == null) return 'data is null'
  if (typeof data !== 'object') return `data is ${typeof data}, expected object`
  const obj = data as Record<string, unknown>
  switch (panelType) {
    case 'text':
      if (typeof obj.content !== 'string') return 'missing content string'
      break
    case 'table':
      if (!Array.isArray(obj.columns)) return 'missing columns array'
      if (!Array.isArray(obj.rows)) return 'missing rows array'
      break
    case 'list':
      if (!Array.isArray(obj.items)) return 'missing items array'
      break
    case 'chart':
      if (!obj.chartType) return 'missing chartType'
      if (!Array.isArray(obj.data)) return 'missing data array'
      break
    case 'code':
      if (typeof obj.language !== 'string') return 'missing language string'
      if (typeof obj.code !== 'string') return 'missing code string'
      break
    case 'image':
      if (typeof obj.src !== 'string') return 'missing src string'
      break
    case 'timeline':
      if (!Array.isArray(obj.events)) return 'missing events array'
      break
    case 'kv':
      if (!Array.isArray(obj.items)) return 'missing items array'
      break
  }
  return undefined
}

/** Check if a panel would be visible in a given canvas view tab */
function isPanelInView(panel: { tags?: string[] }, view: CanvasView): boolean {
  if (view === 'all') return true
  const tags = panel.tags ?? []
  if (view === 'other') {
    const categoryTagValues = Object.values(CATEGORY_TAGS)
    if (tags.length === 0 || tags.includes('other')) return true
    return !tags.some((t) => categoryTagValues.includes(t))
  }
  return tags.includes(CATEGORY_TAGS[view])
}

/** Find the best canvas view tab that contains a panel */
function findBestViewForPanel(panel: { tags?: string[] }): CanvasView {
  for (const view of CANVAS_VIEW_ORDER) {
    if (view === 'all') continue
    if (isPanelInView(panel, view)) return view
  }
  return 'all'
}

export const useCanvasStore = create<CanvasStore>()(
  immer((set, get) => ({
    panels: [],
    archivedPanels: [],
    activeLayout: 'workspace' as LayoutMode,
    activeView: 'important' as CanvasView,
    gridConfig: DEFAULT_GRID_CONFIG,
    panelLayouts: {},
    templates: [],

    createPanel: (message: PanelMessage) => {
      // Validate panel properties
      const validationError = validatePanelProperties(message)
      if (validationError) {
        console.warn(`[canvas-store] Panel rejected: ${validationError}`)
        return
      }

      // Spec Appendix B: if panelId already exists, convert to update
      const existing = get().panels.find(
        (p) => p.panelId === message.panelId,
      )
      if (existing) {
        // Convert to update operation
        if (message.patch) {
          get().patchPanel(message.panelId, message.patch)
        } else if (message.data !== undefined) {
          get().updatePanel(message.panelId, message.data)
        }
        return
      }

      // Validate data via Zod schema if panelType and data are present
      if (message.panelType && message.data !== undefined) {
        const validation = validatePanelData(message.panelType, message.data)
        if (!validation.success) {
          console.warn(
            `[canvas-store] Panel data validation failed for type "${message.panelType}": ${validation.error}`,
          )
          // Still create the panel — the data might be partial or a custom shape
        }
      }

      const now = new Date().toISOString()

      const panel: PanelState = {
        panelId: message.panelId,
        panelType: message.panelType ?? 'text',
        title: message.title ?? 'Untitled',
        subtitle: message.subtitle,
        size: message.size ?? 'md',
        pinned: message.pinned,
        zone: message.zone,
        data: message.data ?? null,
        meta: message.meta,
        realtime: message.realtime,
        html: message.html,
        css: message.css,
        createdAt: now,
        updatedAt: now,
        focused: false,
        starred: message.starred ?? false,
        tags: message.tags ?? [],
        interaction: message.interaction,
      }

      set((state) => {
        state.panels.push(panel)

        // Apply layout position if provided
        if (message.layout) {
          const layout = message.layout
          state.panelLayouts[panel.panelId] = {
            x: layout.x ?? 0,
            y: layout.y ?? 0,
            w: Math.max(1, Math.min(18, layout.w ?? 4)),
            h: Math.max(1, Math.min(18, layout.h ?? 3)),
          }
        }
      })
    },

    updatePanel: (panelId: string, data: unknown) => {
      set((state) => {
        const panel = state.panels.find((p) => p.panelId === panelId)
        if (panel) {
          panel.data = data
          panel.updatedAt = new Date().toISOString()
        }
      })
    },

    patchPanel: (panelId: string, patch: JsonPatchOperation[]) => {
      // Guard against prototype pollution
      if (!validatePatchSafety(patch)) {
        console.error('[canvas-store] Rejected unsafe JSON patch containing prototype pollution attempt')
        return
      }

      set((state) => {
        const idx = state.panels.findIndex((p) => p.panelId === panelId)
        if (idx === -1) return

        // We need to work with a plain object for fast-json-patch.
        // Immer draft objects are proxies, so we extract, patch, then replace.
        const currentPanel = JSON.parse(
          JSON.stringify(state.panels[idx]),
        ) as PanelState
        try {
          const patched = applyJsonPatch(
            currentPanel,
            toFastJsonPatchOps(patch),
          )
          patched.updatedAt = new Date().toISOString()
          state.panels[idx] = patched
        } catch (err) {
          console.warn(
            `[canvas-store] JSON Patch failed for panel "${panelId}":`,
            err,
          )
        }
      })
    },

    archivePanel: (panelId: string) => {
      set((state) => {
        const idx = state.panels.findIndex((p) => p.panelId === panelId)
        if (idx === -1) return

        const panel = state.panels[idx]!
        const archived: ArchivedPanel = {
          panelId: panel.panelId,
          panelType: panel.panelType,
          title: panel.title,
          size: panel.size,
          data: panel.data,
          meta: panel.meta,
          archivedAt: new Date().toISOString(),
        }

        state.archivedPanels.push(archived)
        state.panels.splice(idx, 1)
        delete state.panelLayouts[panelId]
      })
    },

    restorePanel: (panelId: string) => {
      set((state) => {
        const idx = state.archivedPanels.findIndex(
          (p) => p.panelId === panelId,
        )
        if (idx === -1) return

        const archived = state.archivedPanels[idx]!
        const now = new Date().toISOString()

        const panel: PanelState = {
          panelId: archived.panelId,
          panelType: archived.panelType,
          title: archived.title,
          size: archived.size,
          pinned: false,
          zone: 'right',
          data: archived.data,
          meta: archived.meta,
          createdAt: now,
          updatedAt: now,
          focused: false,
        }

        state.panels.push(panel)
        state.archivedPanels.splice(idx, 1)
      })
    },

    deletePanel: (panelId: string) => {
      set((state) => {
        const idx = state.panels.findIndex((p) => p.panelId === panelId)
        if (idx !== -1) {
          state.panels.splice(idx, 1)
          delete state.panelLayouts[panelId]
        }
      })
    },

    deleteArchivedPanel: (panelId: string) => {
      set((state) => {
        const idx = state.archivedPanels.findIndex(
          (p) => p.panelId === panelId,
        )
        if (idx !== -1) {
          state.archivedPanels.splice(idx, 1)
        }
      })
    },

    pinPanel: (panelId: string) => {
      set((state) => {
        const panel = state.panels.find((p) => p.panelId === panelId)
        if (panel) {
          panel.pinned = true
          panel.zone = 'left'
        }
      })
    },

    unpinPanel: (panelId: string) => {
      set((state) => {
        const panel = state.panels.find((p) => p.panelId === panelId)
        if (panel) {
          panel.pinned = false
          panel.zone = 'right'
        }
      })
    },

    toggleStar: (panelId: string) => {
      set((state) => {
        const panel = state.panels.find((p) => p.panelId === panelId)
        if (panel) {
          panel.starred = !panel.starred
        }
      })
    },

    setStar: (panelId: string, starred: boolean) => {
      set((state) => {
        const panel = state.panels.find((p) => p.panelId === panelId)
        if (panel) {
          panel.starred = starred
        }
      })
    },

    setTags: (panelId: string, tags: string[]) => {
      set((state) => {
        const panel = state.panels.find((p) => p.panelId === panelId)
        if (panel) {
          panel.tags = tags
          panel.updatedAt = new Date().toISOString()
        }
      })
    },

    resizePanel: (panelId: string, w: number, h: number) => {
      const clampedW = Math.max(1, Math.min(18, w))
      const clampedH = Math.max(1, Math.min(18, h))
      set((state) => {
        const existing = state.panelLayouts[panelId]
        if (existing) {
          existing.w = clampedW
          existing.h = clampedH
        } else {
          state.panelLayouts[panelId] = { x: 0, y: 0, w: clampedW, h: clampedH }
        }
      })
    },

    changePanelType: (panelId: string, newType: string, newData?: unknown, newTitle?: string, newSubtitle?: string) => {
      set((state) => {
        const panel = state.panels.find((p) => p.panelId === panelId)
        if (!panel) return

        panel.panelType = newType
        panel.data = newData ?? null
        panel.html = undefined
        panel.css = undefined

        if (newTitle !== undefined) {
          panel.title = newTitle
        }
        if (newSubtitle !== undefined) {
          panel.subtitle = newSubtitle
        }

        panel.updatedAt = new Date().toISOString()
      })
    },

    applyAgentLayout: (layout: { panelId: string; x: number; y: number; w: number; h: number }[]) => {
      set((state) => {
        for (const item of layout) {
          state.panelLayouts[item.panelId] = {
            x: item.x,
            y: item.y,
            w: Math.max(1, Math.min(18, item.w)),
            h: Math.max(1, Math.min(18, item.h)),
          }
        }
      })
    },

    switchLayout: (layout: LayoutMode) => {
      set((state) => {
        state.activeLayout = layout
      })
    },

    switchView: (view: CanvasView) => {
      set((state) => {
        state.activeView = view
      })
    },

    navigateView: (direction: 'prev' | 'next'): boolean => {
      const views: CanvasView[] = ['important', 'daily', 'work', 'entertainment', 'other', 'all']
      const current = views.indexOf(get().activeView)
      const next = direction === 'next' ? current + 1 : current - 1
      if (next < 0 || next >= views.length) return false
      set((state) => {
        state.activeView = views[next]!
      })
      return true
    },

    focusPanel: (panelId: string) => {
      const current = get()
      const panel = current.panels.find((p) => p.panelId === panelId)
      if (!panel) return

      // Switch tab if the panel is not visible in the current view
      if (!isPanelInView(panel, current.activeView)) {
        const targetView = findBestViewForPanel(panel)
        set((state) => {
          state.activeView = targetView
        })
      }

      // Set focus on the target panel
      set((state) => {
        for (const p of state.panels) {
          p.focused = p.panelId === panelId
        }
      })

      // Auto-clear focus after 1500ms
      setTimeout(() => {
        set((state) => {
          const p = state.panels.find((p) => p.panelId === panelId)
          if (p) {
            p.focused = false
          }
        })
      }, 1500)
    },

    expandPanel: (panelId: string) => {
      set((state) => {
        const panel = state.panels.find((p) => p.panelId === panelId)
        if (panel) {
          panel.expanded = !panel.expanded
        }
      })
    },

    rearrangePanels: (arrangement: { panelId: string; position: number }[]) => {
      set((state) => {
        const sorted = [...arrangement].sort((a, b) => a.position - b.position)
        const newPanels: typeof state.panels = []
        for (const item of sorted) {
          const panel = state.panels.find((p) => p.panelId === item.panelId)
          if (panel) newPanels.push(panel)
        }
        // Append any panels not in arrangement
        for (const panel of state.panels) {
          if (!arrangement.find((a) => a.panelId === panel.panelId)) {
            newPanels.push(panel)
          }
        }
        state.panels = newPanels
      })
    },

    clearCanvas: (keepPinned: boolean) => {
      set((state) => {
        const toArchive = keepPinned
          ? state.panels.filter((p) => !p.pinned)
          : [...state.panels]

        for (const panel of toArchive) {
          state.archivedPanels.push({
            panelId: panel.panelId,
            panelType: panel.panelType,
            title: panel.title,
            size: panel.size,
            data: panel.data,
            meta: panel.meta,
            archivedAt: new Date().toISOString(),
          })
        }

        // Clean up layout positions for archived panels
        for (const panel of toArchive) {
          delete state.panelLayouts[panel.panelId]
        }

        state.panels = keepPinned
          ? state.panels.filter((p) => p.pinned)
          : []
      })
    },

    setPanelLayouts: (layouts) => {
      set((state) => {
        state.panelLayouts = layouts
      })
    },

    setArchivedPanels: (panels) => {
      set((state) => {
        state.archivedPanels = panels
      })
    },

    setTemplates: (names) => {
      set((state) => {
        state.templates = names
      })
    },

    getCanvasState: (): CanvasStateSnapshot => {
      const state = get()

      const makeSummary = (p: PanelState): PanelSummary => {
        const error = p.html ? undefined : detectRenderError(p.panelType, p.data)
        const layout = state.panelLayouts[p.panelId]
        return {
          id: p.panelId,
          type: p.panelType,
          title: p.title,
          size: p.size,
          dataSummary: summarizeData(p.data),
          ...(error && { error }),
          ...(layout && { layout }),
          ...(p.starred && { starred: p.starred }),
          ...(p.tags && p.tags.length > 0 && { tags: p.tags }),
        }
      }

      const pinnedPanels: PanelSummary[] = state.panels
        .filter((p) => p.pinned)
        .map(makeSummary)

      const transientPanels: PanelSummary[] = state.panels
        .filter((p) => !p.pinned)
        .map(makeSummary)

      const currentTheme = localStorage.getItem('theme') || 'system'
      const customThemes: string[] = JSON.parse(localStorage.getItem('pegboard-custom-themes') || '[]')

      return {
        pinnedPanels,
        transientPanels,
        layoutMode: state.activeLayout,
        activeView: state.activeView,
        archivedCount: state.archivedPanels.length,
        availablePlugins: [...AVAILABLE_PLUGINS],
        templates: state.templates.length > 0 ? state.templates : undefined,
        currentTheme,
        availableThemes: [...BUILTIN_THEMES, 'system', ...customThemes],
      }
    },
  })),
)

// ── Memoized Selectors ──────────────────────────────────────────────
// Use these instead of inline selectors to avoid unnecessary re-renders.

export const selectPanelById = (panelId: string) => (s: ReturnType<typeof useCanvasStore.getState>) =>
  s.panels.find((p) => p.panelId === panelId)

export const selectPanelStarred = (panelId: string) => (s: ReturnType<typeof useCanvasStore.getState>) =>
  s.panels.find((p) => p.panelId === panelId)?.starred ?? false

export const selectPanelInteraction = (panelId: string) => (s: ReturnType<typeof useCanvasStore.getState>) =>
  s.panels.find((p) => p.panelId === panelId)?.interaction
