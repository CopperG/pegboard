import { lazy, type ComponentType } from 'react'
import type { PanelSize } from '@/types/layout'
import type { PanelState } from '@/types/store'
import { TextPanel } from './TextPanel'
import { TablePanel } from './TablePanel'
import { ListPanel } from './ListPanel'
import { ImagePanel } from './ImagePanel'
import { KVPanel } from './KVPanel'
import { FallbackPanel } from './FallbackPanel'

// Lazy-load heavy panel components (recharts, shiki, react-big-calendar)
const ChartPanel = lazy(() => import('./ChartPanel').then((m) => ({ default: m.ChartPanel })))
const CodePanel = lazy(() => import('./CodePanel').then((m) => ({ default: m.CodePanel })))
const TimelinePanel = lazy(() => import('./TimelinePanel').then((m) => ({ default: m.TimelinePanel })))

export interface PanelProps {
  panelId: string
  data: unknown
  size: PanelSize
}

const registry = new Map<string, ComponentType<PanelProps>>()

export function registerPanel(type: string, component: ComponentType<PanelProps>) {
  registry.set(type, component)
}

export function getComponent(type: string): ComponentType<PanelProps> | null {
  return registry.get(type) ?? null
}

// ── Dual-track render resolution ──────────────────────────────────────

export type RenderResult =
  | { type: 'structured'; component: ComponentType<PanelProps> }
  | { type: 'sandbox'; html: string; css?: string }
  | { type: 'fallback'; component: ComponentType<PanelProps> }

export function resolveRenderer(panel: PanelState): RenderResult {
  // 1. If html field is present, use sandbox rendering (takes priority)
  if (panel.html) {
    return { type: 'sandbox', html: panel.html, css: panel.css }
  }

  // 2. If panelType is specified and registered, use structured rendering
  if (panel.panelType) {
    const component = getComponent(panel.panelType)
    if (component) {
      return { type: 'structured', component }
    }
  }

  // 3. Fallback
  return { type: 'fallback', component: getComponent('_fallback')! }
}

/** Called once at app startup to register all built-in panels */
export function initRegistry() {
  registerPanel('text', TextPanel)
  registerPanel('table', TablePanel)
  registerPanel('list', ListPanel)
  registerPanel('chart', ChartPanel)
  registerPanel('code', CodePanel)
  registerPanel('image', ImagePanel)
  registerPanel('timeline', TimelinePanel)
  registerPanel('kv', KVPanel)
  registerPanel('_fallback', FallbackPanel)
}
