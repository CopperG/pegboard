// Store interfaces (Spec §11.1)

import type {
  PanelMeta,
  PanelMessage,
  RealtimeConfig,
  JsonPatchOperation,
  InteractionConfig,
} from './panel-protocol'
import type { LayoutMode, CanvasView, GridLayoutConfig, PanelSize } from './layout'
import type { CanvasStateSnapshot } from './websocket'

// ── Panel State ────────────────────────────────────────────────────────

export interface PanelState {
  panelId: string
  panelType: string
  title: string
  subtitle?: string
  size: PanelSize
  pinned: boolean
  zone: 'left' | 'right'
  data: unknown
  meta?: PanelMeta
  realtime?: RealtimeConfig
  createdAt: string
  updatedAt: string
  html?: string
  css?: string
  focused?: boolean
  expanded?: boolean
  starred?: boolean
  tags?: string[]
  interaction?: InteractionConfig
}

export interface ArchivedPanel {
  panelId: string
  panelType: string
  title: string
  size: PanelSize
  data: unknown
  meta?: PanelMeta
  archivedAt: string
}

// ── Chat ───────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string
  role: 'user' | 'agent'
  content: string
  timestamp: string
  referencedPanels?: string[] // panelIds
}

// ── Layout Position ────────────────────────────────────────────────────

export interface PanelLayoutPosition {
  x: number
  y: number
  w: number
  h: number
}

// ── Canvas Store ───────────────────────────────────────────────────────

export interface CanvasStore {
  panels: PanelState[]
  archivedPanels: ArchivedPanel[]
  activeLayout: LayoutMode
  activeView: CanvasView
  gridConfig: GridLayoutConfig
  panelLayouts: Record<string, PanelLayoutPosition>
  templates: string[]
  createPanel: (message: PanelMessage) => void
  updatePanel: (panelId: string, data: unknown) => void
  patchPanel: (panelId: string, patch: JsonPatchOperation[]) => void
  archivePanel: (panelId: string) => void
  restorePanel: (panelId: string) => void
  deletePanel: (panelId: string) => void
  deleteArchivedPanel: (panelId: string) => void
  pinPanel: (panelId: string) => void
  unpinPanel: (panelId: string) => void
  toggleStar: (panelId: string) => void
  setStar: (panelId: string, starred: boolean) => void
  setTags: (panelId: string, tags: string[]) => void
  resizePanel: (panelId: string, w: number, h: number) => void
  changePanelType: (panelId: string, newType: string, newData?: unknown, newTitle?: string, newSubtitle?: string) => void
  applyAgentLayout: (layout: { panelId: string; x: number; y: number; w: number; h: number }[]) => void
  switchLayout: (layout: LayoutMode) => void
  switchView: (view: CanvasView) => void
  navigateView: (direction: 'prev' | 'next') => boolean
  focusPanel: (panelId: string) => void
  expandPanel: (panelId: string) => void
  rearrangePanels: (arrangement: { panelId: string; position: number }[]) => void
  clearCanvas: (keepPinned: boolean) => void
  getCanvasState: () => CanvasStateSnapshot
  setPanelLayouts: (layouts: Record<string, PanelLayoutPosition>) => void
  setArchivedPanels: (panels: ArchivedPanel[]) => void
  setTemplates: (names: string[]) => void
}

// ── Connection Store ───────────────────────────────────────────────────

export interface ConnectionStore {
  status: 'connected' | 'disconnected' | 'reconnecting'
  lastPingAt: string | null
  reconnectAttempts: number
  nextReconnectIn: number | null

  setStatus: (status: ConnectionStore['status']) => void
  setLastPingAt: (time: string) => void
  incrementReconnectAttempts: () => void
  resetReconnectAttempts: () => void
  setNextReconnectIn: (ms: number | null) => void
}

// ── Chat Store ─────────────────────────────────────────────────────────

export interface ChatStore {
  messages: ChatMessage[]
  isStreaming: boolean

  addMessage: (msg: ChatMessage) => void
  appendToLastMessage: (content: string) => void
  setStreaming: (val: boolean) => void
  clearMessages: () => void
}
