import { useMemo, useState, useRef, useEffect, useCallback } from 'react' // useRef for EditableInput
import { useTranslation } from 'react-i18next'
import { invoke } from '@tauri-apps/api/core'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useCanvasStore } from '@/stores/canvas-store'
import type { PanelProps } from './PanelRegistry'
import type { KVPanelData } from '@/types/panel-data'

// ── Types ───────────────────────────────────────────────────────────

interface KVItem {
  key: string
  value: string
  type?: 'text' | 'number' | 'status' | 'link'
  status?: 'success' | 'warning' | 'error' | 'info'
}

// ── Helpers ─────────────────────────────────────────────────────────

function isKVPanelData(data: unknown): data is KVPanelData {
  if (data == null || typeof data !== 'object') return false
  const obj = data as Record<string, unknown>
  return Array.isArray(obj['items'])
}

const statusDotColors: Record<string, string> = {
  success: 'bg-panel-status-success',
  warning: 'bg-panel-status-warning',
  error: 'bg-panel-status-error',
  info: 'bg-panel-status-info',
}

const STATUS_LABEL_KEYS: Record<string, string> = {
  success: 'status_success',
  warning: 'status_warning',
  error: 'status_error',
  info: 'status_info',
}

// ── Value Renderers ─────────────────────────────────────────────────

function StatusValue({ value, status }: { value: string; status?: string }) {
  const dotClass = status ? statusDotColors[status] ?? 'bg-muted-foreground/60' : 'bg-muted-foreground/60'
  return (
    <span className="inline-flex items-center">
      <span className={`size-2.5 rounded-full inline-block mr-1.5 align-middle ring-1 ring-current/20 ${dotClass}`} />
      <span className="text-foreground">{value}</span>
    </span>
  )
}

// ── Editable Value ──────────────────────────────────────────────────

function EditableInput({
  value,
  type,
  onSubmit,
  onCancel,
}: {
  value: string
  type: string
  onSubmit: (newValue: string) => void
  onCancel: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [editValue, setEditValue] = useState(value)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const handleSubmit = useCallback(() => {
    if (editValue !== value) {
      onSubmit(editValue)
    } else {
      onCancel()
    }
  }, [editValue, value, onSubmit, onCancel])

  return (
    <input
      ref={inputRef}
      type={type === 'number' ? 'number' : 'text'}
      className="w-full rounded border bg-background px-1.5 py-0.5 text-sm outline-none ring-2 ring-primary/50"
      value={editValue}
      onChange={(e) => setEditValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && e.nativeEvent.keyCode !== 229) {
          e.preventDefault()
          handleSubmit()
        }
        if (e.key === 'Escape') {
          e.preventDefault()
          onCancel()
        }
      }}
      onBlur={handleSubmit}
    />
  )
}

function StatusSelector({
  currentStatus,
  onSelect,
}: {
  currentStatus?: string
  onSelect: (status: string) => void
}) {
  const { t } = useTranslation('panels')
  const statuses = ['success', 'warning', 'error', 'info'] as const
  return (
    <div className="flex flex-col gap-1 p-1">
      <div className="text-xs font-medium text-muted-foreground mb-1">{t('select_status')}</div>
      {statuses.map((s) => (
        <button
          key={s}
          className={`flex items-center gap-2 px-2 py-1 rounded text-xs hover:bg-muted/50 transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none ${
            currentStatus === s ? 'bg-muted' : ''
          }`}
          onClick={() => onSelect(s)}
        >
          <span
            className={`w-2.5 h-2.5 rounded-full ${statusDotColors[s] ?? 'bg-muted-foreground/60'}`}
          />
          <span>{t(STATUS_LABEL_KEYS[s] ?? s)}</span>
        </button>
      ))}
    </div>
  )
}

function EditableKVItem({
  item,
  panelId,
  editable,
}: {
  item: KVItem
  panelId: string
  editable: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [localValue, setLocalValue] = useState(item.value)
  const [localStatus, setLocalStatus] = useState(item.status)
  const [statusOpen, setStatusOpen] = useState(false)

  // Sync local state with external data changes
  useEffect(() => {
    if (!editing) {
      setLocalValue(item.value)
      setLocalStatus(item.status)
    }
  }, [item.value, item.status, editing])

  const sendEditAction = useCallback(
    (oldValue: string, newValue: string, extra?: Record<string, unknown>) => {
      invoke('send_ws_message', {
        message: JSON.stringify({
          type: 'panel_user_action',
          action: 'edit_value',
          panelId,
          payload: { key: item.key, oldValue, newValue, ...extra },
          timestamp: new Date().toISOString(),
        }),
      }).catch(console.error)
    },
    [panelId, item.key],
  )

  const handleSubmit = useCallback(
    (newValue: string) => {
      setLocalValue(newValue)
      setEditing(false)

      // Optimistic update in store
      const store = useCanvasStore.getState()
      const panel = store.panels.find((p) => p.panelId === panelId)
      if (panel && panel.data && typeof panel.data === 'object') {
        const panelData = panel.data as KVPanelData
        const updatedItems = panelData.items.map((i) =>
          i.key === item.key ? { ...i, value: newValue } : i,
        )
        store.updatePanel(panelId, { ...panelData, items: updatedItems })
      }

      sendEditAction(item.value, newValue)
    },
    [item.key, item.value, panelId, sendEditAction],
  )

  const handleStatusChange = useCallback(
    (newStatus: string) => {
      setLocalStatus(newStatus as KVItem['status'])
      setStatusOpen(false)

      // Optimistic update in store
      const store = useCanvasStore.getState()
      const panel = store.panels.find((p) => p.panelId === panelId)
      if (panel && panel.data && typeof panel.data === 'object') {
        const panelData = panel.data as KVPanelData
        const updatedItems = panelData.items.map((i) =>
          i.key === item.key ? { ...i, status: newStatus as KVItem['status'] } : i,
        )
        store.updatePanel(panelId, { ...panelData, items: updatedItems })
      }

      invoke('send_ws_message', {
        message: JSON.stringify({
          type: 'panel_user_action',
          action: 'status_change',
          panelId,
          payload: {
            key: item.key,
            oldStatus: item.status,
            newStatus,
          },
          timestamp: new Date().toISOString(),
        }),
      }).catch(console.error)
    },
    [item.key, item.status, panelId],
  )

  const handleCancel = useCallback(() => {
    setLocalValue(item.value)
    setEditing(false)
  }, [item.value])

  const type = item.type ?? 'text'

  // Render value area
  const renderValue = () => {
    if (editing && type !== 'status') {
      return (
        <EditableInput
          value={localValue}
          type={type}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />
      )
    }

    if (type === 'status' && editable) {
      const dotClass = localStatus
        ? statusDotColors[localStatus] ?? 'bg-muted-foreground/60'
        : 'bg-muted-foreground/60'
      return (
        <Popover open={statusOpen} onOpenChange={setStatusOpen}>
          <PopoverTrigger className="inline-flex items-center cursor-pointer hover:opacity-80">
            <span className={`size-2.5 rounded-full inline-block mr-1.5 ring-1 ring-current/20 ${dotClass}`} />
            <span className="text-foreground">{localValue}</span>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-40">
            <StatusSelector
              currentStatus={localStatus}
              onSelect={handleStatusChange}
            />
          </PopoverContent>
        </Popover>
      )
    }

    // Non-editable, or status without editable flag
    switch (type) {
      case 'number':
        return (
          <span className="text-foreground font-mono font-semibold tabular-nums truncate">
            {localValue}
          </span>
        )
      case 'status':
        return <StatusValue value={localValue} status={localStatus} />
      case 'link':
        return (
          <span className="text-primary cursor-pointer hover:underline underline-offset-2 truncate">{localValue}</span>
        )
      default:
        return <span className="text-foreground">{localValue}</span>
    }
  }

  return (
    <div className="flex items-baseline justify-between gap-3 min-w-0 py-1.5 border-b border-border/15 last:border-b-0">
      <div className="text-xs text-muted-foreground shrink-0 truncate max-w-[40%]">
        {item.key}
      </div>
      <div
        className={`text-sm font-medium text-foreground truncate text-right ${
          editable && type !== 'status' ? 'cursor-pointer rounded hover:bg-muted/50 -mx-1 px-1' : ''
        }`}
        onDoubleClick={
          editable && type !== 'status'
            ? () => setEditing(true)
            : undefined
        }
      >
        {renderValue()}
      </div>
    </div>
  )
}

// ── KVPanel (main) ──────────────────────────────────────────────────

export function KVPanel({ panelId, data }: PanelProps) {
  const { t } = useTranslation('panels')
  const interaction = useCanvasStore(
    (s) => s.panels.find((p) => p.panelId === panelId)?.interaction,
  )
  const editable = interaction?.editable ?? false

  const panelData = useMemo<KVPanelData | null>(() => {
    if (isKVPanelData(data)) return data
    return null
  }, [data])

  if (!panelData) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        {t('cannot_render', { type: t('kv') })}: {t('invalid_data')} (panelId: {panelId})
      </div>
    )
  }

  const { items, columns: configuredColumns = 2 } = panelData
  const cols = Math.max(1, Math.min(3, configuredColumns))

  if (items.length === 0) {
    return (
      <div
        className="flex items-center justify-center h-full text-sm text-muted-foreground"
      >
        {t('no_data')}
      </div>
    )
  }

  return (
    <div className="relative h-full">
      <div className="h-full overflow-y-auto">
        <div
          className="grid gap-x-4 gap-y-0"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {items.map((item, idx) => (
            <EditableKVItem
              key={`${item.key}-${idx}`}
              item={item}
              panelId={panelId}
              editable={editable}
            />
          ))}
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-6 pointer-events-none" style={{ background: 'linear-gradient(to top, var(--card), transparent)' }} />
    </div>
  )
}
