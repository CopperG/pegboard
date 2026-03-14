import { useCallback, useState, useEffect, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useCanvasStore } from '@/stores/canvas-store'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { CanvasView } from '@/types/layout'
import { CANVAS_VIEW_ORDER, CATEGORY_TAGS } from '@/types/layout'
import { LayoutGrid, Star, Clock, Briefcase, Gamepad2, MoreHorizontal, PanelLeft, MessageSquare } from 'lucide-react'
import { ArchiveDrawer } from '@/components/canvas/ArchiveDrawer'
import { ConnectionDot } from '@/components/layout/Sidebar'
import { SettingsMenu } from '@/components/layout/Sidebar'

const TAB_KEYS: Record<CanvasView, string> = {
  important: 'important',
  daily: 'daily',
  work: 'work',
  entertainment: 'entertainment',
  other: 'other',
  all: 'all',
}

const TAB_ICONS: Record<CanvasView, ReactNode> = {
  all: <LayoutGrid className="w-5 h-5" />,
  important: <Star className="w-5 h-5" />,
  daily: <Clock className="w-5 h-5" />,
  work: <Briefcase className="w-5 h-5" />,
  entertainment: <Gamepad2 className="w-5 h-5" />,
  other: <MoreHorizontal className="w-5 h-5" />,
}

interface CanvasTabsProps {
  sidebarOpen: boolean
  onToggleSidebar: () => void
  chatOpen: boolean
  onToggleChat: () => void
}

export function CanvasTabs({ sidebarOpen, onToggleSidebar, chatOpen, onToggleChat }: CanvasTabsProps) {
  const { t } = useTranslation('canvas')
  const activeView = useCanvasStore((s) => s.activeView)
  const switchView = useCanvasStore((s) => s.switchView)
  const [isDraggingPanel, setIsDraggingPanel] = useState(false)
  const [dragOverView, setDragOverView] = useState<CanvasView | null>(null)

  // Listen for panel drag start/end globally
  useEffect(() => {
    const handleDragStart = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('text/panel-id')) {
        setIsDraggingPanel(true)
      }
    }
    const handleDragEnd = () => {
      setIsDraggingPanel(false)
      setDragOverView(null)
    }
    document.addEventListener('dragstart', handleDragStart)
    document.addEventListener('dragend', handleDragEnd)
    return () => {
      document.removeEventListener('dragstart', handleDragStart)
      document.removeEventListener('dragend', handleDragEnd)
    }
  }, [])

  const handleTabKeyDown = useCallback((e: React.KeyboardEvent) => {
    const tabs = e.currentTarget.querySelectorAll('[role="tab"]')
    const currentIndex = Array.from(tabs).indexOf(e.target as Element)
    if (currentIndex === -1) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const next = tabs[(currentIndex + 1) % tabs.length] as HTMLElement
      next?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const prev = tabs[(currentIndex - 1 + tabs.length) % tabs.length] as HTMLElement
      prev?.focus()
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, view: CanvasView) => {
    e.preventDefault()
    setDragOverView(null)
    const panelId = e.dataTransfer.getData('text/panel-id')
    if (!panelId || view === 'all') return

    const store = useCanvasStore.getState()
    const panel = store.panels.find((p) => p.panelId === panelId)
    if (!panel) return

    const tag = CATEGORY_TAGS[view]
    const currentTags = panel.tags ?? []

    if (currentTags.includes(tag)) {
      toast.info(t('already_in_category'))
      return
    }

    store.setTags(panelId, [...currentTags, tag])
    toast.success(t('added_to_category', { category: t(TAB_KEYS[view]) }))
  }, [t])

  return (
    <div data-canvas-tabs className="flex flex-col items-center py-3 gap-1 shrink-0 border-r border-border/50 bg-muted/30 w-12">
      <div className="flex flex-col items-center gap-1" role="tablist" onKeyDown={handleTabKeyDown}>
        {CANVAS_VIEW_ORDER.map((view) => {
          const isActive = activeView === view
          const isDropTarget = isDraggingPanel && view !== 'all'
          const isHovered = dragOverView === view

          return (
            <div key={view} className="relative group">
              <button
                type="button"
                role="tab"
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                className={cn(
                  'relative flex items-center justify-center w-9 h-9 rounded-lg transition-all',
                  'focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none',
                  isActive
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
                  isDropTarget && 'ring-1.5 ring-dashed ring-primary/40 bg-primary/5',
                  isHovered && 'ring-2 ring-solid ring-primary bg-primary/15 scale-105 text-primary',
                )}
                onClick={() => switchView(view)}
                aria-label={t(TAB_KEYS[view])}
                onDragOver={(e) => {
                  if (view === 'all') return
                  e.preventDefault()
                }}
                onDragEnter={() => {
                  if (view !== 'all') setDragOverView(view)
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setDragOverView(null)
                  }
                }}
                onDrop={(e) => handleDrop(e, view)}
              >
                {TAB_ICONS[view]}
                {/* Active indicator bar on the left */}
                {isActive && (
                  <motion.span
                    layoutId="tab-indicator"
                    className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-primary rounded-full"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
              </button>
              {/* Tooltip on hover */}
              <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 bg-popover text-popover-foreground text-xs font-medium rounded-md shadow-md border border-border/50 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50">
                {t(TAB_KEYS[view])}
              </div>
            </div>
          )
        })}
      </div>

      {/* Separator + panel list toggle */}
      <div className="w-6 h-px bg-border/50 my-1" />
      <div className="relative group">
        <button
          type="button"
          className={cn(
            'flex items-center justify-center w-9 h-9 rounded-lg transition-all',
            'focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none',
            sidebarOpen
              ? 'bg-primary/15 text-primary'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
          )}
          onClick={onToggleSidebar}
          aria-label={t('toggle_sidebar')}
        >
          <PanelLeft className="w-5 h-5" />
        </button>
        <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 bg-popover text-popover-foreground text-xs font-medium rounded-md shadow-md border border-border/50 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50">
          {t('toggle_sidebar')}
        </div>
      </div>

      {/* Spacer pushes bottom items down */}
      <div className="flex-1" />

      {/* Bottom: Chat, Archive, Connection, Settings */}
      <div className="flex flex-col items-center gap-1">
        <div className="relative group">
          <button
            type="button"
            className={cn(
              'flex items-center justify-center w-9 h-9 rounded-lg transition-all',
              'focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none',
              chatOpen
                ? 'bg-primary/15 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
            )}
            onClick={onToggleChat}
            aria-label={t('toggle_chat')}
          >
            <MessageSquare className="w-5 h-5" />
          </button>
          <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 bg-popover text-popover-foreground text-xs font-medium rounded-md shadow-md border border-border/50 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50">
            {t('toggle_chat')}
          </div>
        </div>

        <div className="relative group flex items-center justify-center w-9 h-9">
          <ArchiveDrawer />
        </div>

        <div className="relative group flex items-center justify-center w-9 h-9">
          <ConnectionDot />
        </div>

        <div className="relative group flex items-center justify-center w-9 h-9">
          <SettingsMenu collapsed />
        </div>
      </div>
    </div>
  )
}
