// Panel Protocol — Four-layer types (Spec §5.1-5.7)

// ── Envelope Layer (§5.2) ──────────────────────────────────────────────

export interface PanelEnvelope {
  action: 'create' | 'update' | 'archive' | 'delete'
  panelId: string
  pinned: boolean
  zone: 'left' | 'right'
}

// ── Type Layer (§5.3) ──────────────────────────────────────────────────

export interface PanelTypeLayer {
  panelType:
    | 'text'
    | 'table'
    | 'list'
    | 'chart'
    | 'code'
    | 'image'
    | 'timeline'
    | 'kv'
    | 'html'
  title: string
  subtitle?: string
  size: 'sm' | 'md' | 'lg' | 'full'
}

// ── Meta Layer (§5.5) ──────────────────────────────────────────────────

export interface PanelMeta {
  source: string
  timestamp: string
  ttl?: number
  priority?: 'low' | 'normal' | 'high'
}

// ── Interaction Config (Phase 3 §Issue 22) ──────────────────────────────

export interface InteractionConfig {
  sortable?: boolean
  filterable?: boolean
  checkable?: boolean
  editable?: boolean
}

// ── Realtime Config (§5.7, Phase 2 placeholder) ────────────────────────

export interface RealtimeConfig {
  enabled: boolean
  source: string
  url?: string
  params?: Record<string, unknown>
  interval: number
  maxRetries: number
}

// ── JSON Patch (§5.6, RFC 6902) ────────────────────────────────────────

export interface JsonPatchOperation {
  op: 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test'
  path: string
  value?: unknown
  from?: string
}

// ── Complete Panel Message ─────────────────────────────────────────────
// Combines all four layers into a single wire-format message.

export interface PanelMessage extends PanelEnvelope, Partial<PanelTypeLayer> {
  data?: unknown
  html?: string
  css?: string
  patch?: JsonPatchOperation[]
  meta?: PanelMeta
  realtime?: RealtimeConfig
  interaction?: InteractionConfig
  starred?: boolean
  tags?: string[]
  layout?: { x?: number; y?: number; w?: number; h?: number }
}
