// WebSocket message types (Spec §10.2-10.4)

import type { PanelMessage } from './panel-protocol'
import type { LayoutMode, CanvasView } from './layout'

// ── Supporting Types ───────────────────────────────────────────────────

export interface Attachment {
  type: 'image' | 'file' | 'audio'
  name: string
  path: string
  size: number
  mimeType: string
}

export interface PanelSummary {
  id: string
  type: string
  title: string
  size?: string
  dataSummary?: string
  error?: string
  layout?: { x: number; y: number; w: number; h: number }
  starred?: boolean
  tags?: string[]
}

export interface CanvasStateSnapshot {
  pinnedPanels: PanelSummary[]
  transientPanels: PanelSummary[]
  layoutMode: LayoutMode
  activeView: CanvasView
  archivedCount: number
  availablePlugins?: string[]
  templates?: string[]
  currentTheme: string
  availableThemes: string[]
}

export interface ReferencedPanel {
  panelId: string
  panelType: string
  data: unknown
}

// ── Frontend → OpenClaw ────────────────────────────────────────────────

export interface UserMessage {
  type: 'user_message'
  content: string
  canvasState: CanvasStateSnapshot
  referencedPanels?: ReferencedPanel[]
  attachments?: Attachment[]
  timestamp: string
}

export interface PanelUserAction {
  type: 'panel_user_action'
  action: 'pin' | 'unpin' | 'archive' | 'restore' | 'close' | 'check_item' | 'edit_value' | 'status_change'
  panelId: string
  payload?: Record<string, unknown>
  timestamp: string
}

export interface PanelError {
  type: 'panel_error'
  panelId: string
  error:
    | 'INVALID_JSON'
    | 'SCHEMA_VALIDATION_FAILED'
    | 'HTML_RENDER_ERROR'
    | 'UNKNOWN'
  rawOutput?: string
  fallback?: string
  suggestion?: string
  timestamp: string
}

// ── OpenClaw → Frontend ────────────────────────────────────────────────

export interface AgentResponse {
  type: 'response'
  chatMessage: string
  panels?: PanelMessage[]
  timestamp: string
}

export interface PanelActionMessage {
  type: 'panel_action'
  panels: PanelMessage[]
}

// ── Streaming Messages (Spec §9.5) ────────────────────────────────────

export interface StreamStart {
  type: 'stream_start'
  messageId: string
  timestamp: string
}

export interface StreamChunk {
  type: 'stream_chunk'
  messageId: string
  content: string
}

export interface StreamEnd {
  type: 'stream_end'
  messageId: string
  timestamp: string
}

// ── Canvas Control (Spec §7.4 canvas_control) ────────────────────────

export interface CanvasControlMessage {
  type: 'canvas_control'
  action:
    | 'switchView'
    | 'focusPanel'
    | 'expandPanel'
    | 'rearrangePanels'
    | 'clearCanvas'
    | 'applyLayout'
    | 'setLayout'
  panelId?: string
  view?: CanvasView
  arrangement?: { panelId: string; position: number }[]
  keepPinned?: boolean
  preset?: string
  layout?: { panelId: string; x: number; y: number; w: number; h: number }[]
}

// ── App Control (Spec §7.4 app_control) ──────────────────────────────

export interface AppControlMessage {
  type: 'app_control'
  action:
    | 'showTyping'
    | 'showProgress'
    | 'showNotification'
    | 'setTheme'
    | 'registerTheme'
    | 'setBadge'
    | 'requestAttention'
  isTyping?: boolean
  percent?: number
  label?: string
  title?: string
  body?: string
  notificationType?: 'info' | 'success' | 'warning' | 'error'
  theme?: string
  themeName?: string
  css?: string
  count?: number
}

// ── Canvas State Query (Spec §6.3) ───────────────────────────────────

export interface GetCanvasState {
  type: 'get_canvas_state'
}

export interface CanvasStateResponse {
  type: 'canvas_state_response'
  canvasState: CanvasStateSnapshot
}

// ── Panel Detail Query ────────────────────────────────────────────────

export interface GetPanelDetail {
  type: 'get_panel_detail'
  panelId: string
}

export interface PanelDetailResponse {
  type: 'panel_detail_response'
  panelId: string
  panel?: Record<string, unknown>
  error?: string
}

// ── Realtime Control (Phase 3 §Issue 24) ─────────────────────────────

export interface RealtimeControlMessage {
  type: 'realtime_control'
  action: 'start' | 'stop' | 'set_interval'
  panelId: string
  config?: import('./panel-protocol').RealtimeConfig
  interval?: number
}

// ── Union Type ─────────────────────────────────────────────────────────

export type WebSocketMessage =
  | UserMessage
  | PanelUserAction
  | PanelError
  | AgentResponse
  | PanelActionMessage
  | StreamStart
  | StreamChunk
  | StreamEnd
  | CanvasControlMessage
  | AppControlMessage
  | GetCanvasState
  | CanvasStateResponse
  | GetPanelDetail
  | PanelDetailResponse
  | RealtimeControlMessage
