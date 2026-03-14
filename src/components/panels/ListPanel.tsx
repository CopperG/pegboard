import { useMemo, useCallback, useRef, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { List } from 'react-window'
import { invoke } from '@tauri-apps/api/core'
import { ChevronRight } from 'lucide-react'
import { useCanvasStore } from '@/stores/canvas-store'
import type { PanelProps } from './PanelRegistry'

interface ListBadge {
  text: string
  color: 'red' | 'green' | 'blue' | 'yellow' | 'gray'
}

interface ListItem {
  id: string
  title: string
  subtitle?: string
  icon?: string
  badge?: ListBadge
  linkedPanel?: string
  metadata?: Record<string, unknown>
}

interface ListPanelData {
  items: ListItem[]
  emptyText?: string
}

function isListPanelData(data: unknown): data is ListPanelData {
  if (data == null || typeof data !== 'object') return false
  const obj = data as Record<string, unknown>
  return Array.isArray(obj['items'])
}

const badgeColors: Record<string, string> = {
  red: 'panel-badge-red',
  green: 'panel-badge-green',
  blue: 'panel-badge-blue',
  yellow: 'panel-badge-yellow',
  gray: 'panel-badge-gray',
}

function ListItemRow({
  item,
  onNavigate,
  style,
  checkable,
  checked,
  onCheck,
}: {
  item: ListItem
  onNavigate: (panelId: string) => void
  style?: React.CSSProperties
  checkable?: boolean
  checked?: boolean
  onCheck?: (itemId: string, checked: boolean) => void
}) {
  const hasLink = !!item.linkedPanel
  const handleClick = useCallback(() => {
    if (item.linkedPanel) {
      onNavigate(item.linkedPanel)
    }
  }, [item.linkedPanel, onNavigate])

  return (
    <div
      role={hasLink ? 'button' : undefined}
      tabIndex={hasLink ? 0 : undefined}
      className={`flex items-center gap-2 px-2.5 py-1.5 border-b border-border/15 last:border-b-0 transition-colors ${
        hasLink ? 'hover:bg-muted/50 cursor-pointer' : ''
      } ${checked ? 'opacity-50' : ''}`}
      style={style}
      onClick={hasLink && !checkable ? handleClick : undefined}
      onKeyDown={
        hasLink
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handleClick()
              }
            }
          : undefined
      }
    >
      {/* Checkbox */}
      {checkable && (
        <label
          className="flex items-center shrink-0 cursor-pointer"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            className="rounded border-muted-foreground w-3.5 h-3.5 cursor-pointer"
            checked={checked ?? false}
            onChange={(e) => {
              onCheck?.(item.id, e.target.checked)
            }}
          />
        </label>
      )}

      {/* Icon */}
      {item.icon && (
        <div className="flex items-center justify-center w-4 h-4 shrink-0 text-xs leading-none">
          {item.icon}
        </div>
      )}

      {/* Title + Subtitle */}
      <div className="flex-1 min-w-0" onClick={hasLink && checkable ? handleClick : undefined}>
        <div className={`font-medium text-xs truncate ${checked ? 'line-through' : ''}`}>
          {item.title}
        </div>
        {item.subtitle && (
          <div className={`text-xs text-muted-foreground truncate ${checked ? 'line-through' : ''}`}>
            {item.subtitle}
          </div>
        )}
      </div>

      {/* Badge */}
      {item.badge && (
        <span
          className={`shrink-0 inline-flex items-center rounded-full px-1.5 py-px text-[10px] font-medium max-w-[72px] truncate ${
            badgeColors[item.badge.color] ?? badgeColors['gray']
          }`}
        >
          {item.badge.text}
        </span>
      )}

      {/* Link indicator */}
      {hasLink && (
        <ChevronRight className="shrink-0 size-4 text-muted-foreground" />
      )}
    </div>
  )
}

/** Virtual row renderer for react-window v2 */
interface VirtualRowProps {
  items: ListItem[]
  onNavigate: (panelId: string) => void
  checkable?: boolean
  checkedIds?: Set<string>
  onCheck?: (itemId: string, checked: boolean) => void
}

function VirtualRow({
  index,
  style,
  items,
  onNavigate,
  checkable,
  checkedIds,
  onCheck,
}: {
  index: number
  style: React.CSSProperties
  ariaAttributes: unknown
} & VirtualRowProps) {
  const item = items[index]
  if (!item) return null
  return (
    <ListItemRow
      item={item}
      onNavigate={onNavigate}
      style={style}
      checkable={checkable}
      checked={checkedIds?.has(item.id)}
      onCheck={onCheck}
    />
  )
}

export function ListPanel({ panelId, data }: PanelProps) {
  const { t } = useTranslation('panels')
  const { t: tCommon } = useTranslation('common')
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerHeight, setContainerHeight] = useState(400)
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())

  const interaction = useCanvasStore(
    (s) => s.panels.find((p) => p.panelId === panelId)?.interaction,
  )
  const checkable = interaction?.checkable ?? false

  const panelData = useMemo<ListPanelData | null>(() => {
    if (isListPanelData(data)) return data
    return null
  }, [data])

  const handleNavigate = useCallback((targetPanelId: string) => {
    useCanvasStore.getState().focusPanel(targetPanelId)
    invoke('send_ws_message', {
      message: JSON.stringify({
        type: 'panel_user_action',
        action: 'focus',
        panelId: targetPanelId,
        timestamp: new Date().toISOString(),
      }),
    }).catch(console.error)
  }, [])

  const handleCheck = useCallback(
    (itemId: string, checked: boolean) => {
      setCheckedIds((prev) => {
        const next = new Set(prev)
        if (checked) {
          next.add(itemId)
        } else {
          next.delete(itemId)
        }
        return next
      })

      // Send action to agent
      invoke('send_ws_message', {
        message: JSON.stringify({
          type: 'panel_user_action',
          action: 'check_item',
          panelId,
          payload: { itemId, checked },
          timestamp: new Date().toISOString(),
        }),
      }).catch(console.error)
    },
    [panelId],
  )

  const handleSelectAll = useCallback(() => {
    if (!panelData) return
    const allIds = new Set(panelData.items.map((item) => item.id))
    const allChecked = panelData.items.every((item) => checkedIds.has(item.id))

    if (allChecked) {
      setCheckedIds(new Set())
    } else {
      setCheckedIds(allIds)
    }

    // Send bulk action - we notify agent about the toggle
    for (const item of panelData.items) {
      const newChecked = !allChecked
      if (newChecked !== checkedIds.has(item.id)) {
        invoke('send_ws_message', {
          message: JSON.stringify({
            type: 'panel_user_action',
            action: 'check_item',
            panelId,
            payload: { itemId: item.id, checked: newChecked },
            timestamp: new Date().toISOString(),
          }),
        }).catch(console.error)
      }
    }
  }, [panelData, panelId, checkedIds])

  // Measure container height for virtual scrolling
  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height)
      }
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  if (!panelData) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        {t('cannot_render', { type: t('list') })}: {t('invalid_data')} (panelId: {panelId})
      </div>
    )
  }

  if (panelData.items.length === 0) {
    return (
      <div className="p-4 flex items-center justify-center text-sm text-muted-foreground">
        {panelData.emptyText ?? t('no_data')}
      </div>
    )
  }

  const checkedCount = panelData.items.filter((item) => checkedIds.has(item.id)).length
  const allChecked = checkedCount === panelData.items.length && panelData.items.length > 0
  const someChecked = checkedCount > 0 && !allChecked

  // Use virtual scrolling for large lists (>50 items)
  if (panelData.items.length > 50) {
    const hasSubtitle = panelData.items.some((item) => item.subtitle)
    const itemSize = hasSubtitle ? 44 : 30

    return (
      <div className="flex flex-col h-full w-full">
        {checkable && (
          <div className="flex items-center gap-2 px-2.5 py-1 border-b bg-muted/30 text-xs text-muted-foreground shrink-0">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="rounded border-muted-foreground w-3.5 h-3.5 cursor-pointer"
                checked={allChecked}
                ref={(el) => {
                  if (el) el.indeterminate = someChecked
                }}
                onChange={handleSelectAll}
              />
              <span>{tCommon('select_all')}</span>
            </label>
            <span className="ml-auto">
              {tCommon('completed_count', { done: checkedCount, total: panelData.items.length })}
            </span>
          </div>
        )}
        <div ref={containerRef} className="flex-1 min-h-0">
          <List<VirtualRowProps>
            rowComponent={VirtualRow}
            rowCount={panelData.items.length}
            rowHeight={itemSize}
            rowProps={{
              items: panelData.items,
              onNavigate: handleNavigate,
              checkable,
              checkedIds,
              onCheck: handleCheck,
            }}
            style={{ height: containerHeight, width: '100%' }}
          />
        </div>
      </div>
    )
  }

  // Plain rendering for small lists
  return (
    <div className="flex flex-col h-full">
        {checkable && (
          <div className="flex items-center gap-2 px-2.5 py-1 border-b bg-muted/30 text-xs text-muted-foreground shrink-0">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="rounded border-muted-foreground w-3.5 h-3.5 cursor-pointer"
                checked={allChecked}
                ref={(el) => {
                  if (el) el.indeterminate = someChecked
                }}
                onChange={handleSelectAll}
              />
              <span>{tCommon('select_all')}</span>
            </label>
            <span className="ml-auto">
              {tCommon('completed_count', { done: checkedCount, total: panelData.items.length })}
            </span>
          </div>
        )}
        <div className="overflow-y-auto flex-1">
          {panelData.items.map((item) => (
            <ListItemRow
              key={item.id}
              item={item}
              onNavigate={handleNavigate}
              checkable={checkable}
              checked={checkedIds.has(item.id)}
              onCheck={handleCheck}
            />
          ))}
        </div>
        {checkable && (
          <div className="flex items-center px-2.5 py-1 border-t bg-muted/30 text-xs text-muted-foreground shrink-0">
            {tCommon('completed_count', { done: checkedCount, total: panelData.items.length })}
          </div>
        )}
    </div>
  )
}
