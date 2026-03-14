import { useState, useCallback, type ReactNode, type DragEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useCanvasStore } from '@/stores/canvas-store'
import { useConnectionStore } from '@/stores/connection-store'
import { useTheme, type Theme } from '@/hooks/useTheme'
import { getPanelIcon } from '@/lib/panel-icons'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Settings, Pin, Archive, Sun, Moon, Newspaper, Palette, Monitor, Flame,
  ChevronLeft, ChevronRight, Languages, Check,
} from 'lucide-react'
import type { PanelState } from '@/types/store'

export function ConnectionDot() {
  const { t } = useTranslation('sidebar')
  const status = useConnectionStore((s) => s.status)

  const colorClass =
    status === 'connected'
      ? 'bg-panel-status-success'
      : status === 'reconnecting'
        ? 'bg-panel-status-warning'
        : 'bg-muted-foreground/40'

  const label =
    status === 'connected'
      ? t('connected')
      : status === 'reconnecting'
        ? t('reconnecting')
        : t('disconnected')

  return (
    <div className="relative group flex items-center justify-center" role="status">
      <span className={cn('size-2.5 rounded-full shrink-0', colorClass)} title={label} />
      <span className="sr-only">{label}</span>
      <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2 py-1 bg-popover text-popover-foreground text-xs font-medium rounded-md shadow-md border border-border/50 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50">
        {label}
      </div>
    </div>
  )
}

function SidebarPanelItem({
  panel,
  collapsed,
  onDragStart,
  onDragEnd,
  isDragged,
}: {
  panel: PanelState
  collapsed: boolean
  onDragStart?: (panelId: string) => void
  onDragEnd?: () => void
  isDragged?: boolean
}) {
  const { t } = useTranslation('panels')
  const focusPanel = useCanvasStore((s) => s.focusPanel)
  const pinPanel = useCanvasStore((s) => s.pinPanel)
  const unpinPanel = useCanvasStore((s) => s.unpinPanel)
  const archivePanel = useCanvasStore((s) => s.archivePanel)

  const icon = getPanelIcon(panel.panelType)

  const handleDragStart = (e: DragEvent<HTMLElement>) => {
    e.dataTransfer.setData('text/plain', panel.panelId)
    e.dataTransfer.effectAllowed = 'move'
    onDragStart?.(panel.panelId)
  }

  const handleDragEnd = () => {
    onDragEnd?.()
  }

  if (collapsed) {
    return (
      <button
        type="button"
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        data-dragging={isDragged || undefined}
        className={cn(
          'w-full flex items-center justify-center py-1.5 rounded hover:bg-muted/50 transition-colors text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none',
          isDragged && 'opacity-50',
        )}
        onClick={() => focusPanel(panel.panelId)}
        title={panel.title}
        aria-label={panel.title}
      >
        {icon}
      </button>
    )
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      data-dragging={isDragged || undefined}
      className={cn(
        'group flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none',
        isDragged && 'opacity-50',
      )}
      onClick={() => focusPanel(panel.panelId)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') focusPanel(panel.panelId)
      }}
    >
      <span className="shrink-0 text-muted-foreground">{icon}</span>
      <span className="text-sm truncate flex-1">{panel.title}</span>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          type="button"
          className="p-0.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
          title={panel.pinned ? t('unpin') : t('pin')}
          aria-label={panel.pinned ? t('unpin') : t('pin')}
          onClick={(e) => {
            e.stopPropagation()
            panel.pinned ? unpinPanel(panel.panelId) : pinPanel(panel.panelId)
          }}
        >
          <Pin className="w-3 h-3" />
        </button>
        <button
          type="button"
          className="p-0.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
          title={t('archive')}
          aria-label={t('archive')}
          onClick={(e) => {
            e.stopPropagation()
            archivePanel(panel.panelId)
          }}
        >
          <Archive className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}

const THEME_ICONS: Record<Theme, ReactNode> = {
  light: <Sun className="w-4 h-4" />,
  dark: <Moon className="w-4 h-4" />,
  vintage: <Newspaper className="w-4 h-4" />,
  doodle: <Palette className="w-4 h-4" />,
  blaze: <Flame className="w-4 h-4" />,
  system: <Monitor className="w-4 h-4" />,
}

const THEME_KEYS: Theme[] = ['light', 'dark', 'vintage', 'doodle', 'blaze', 'system']

const LANGUAGE_OPTIONS = [
  { value: 'zh-CN', label: '中文', flag: '🇨🇳' },
  { value: 'en', label: 'English', flag: '🇺🇸' },
] as const

export function SettingsMenu({ collapsed }: { collapsed: boolean }) {
  const { t: tSettings } = useTranslation('settings')
  const { t: tCommon } = useTranslation('common')
  const { theme, setTheme } = useTheme()
  const { i18n } = useTranslation()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        title={tCommon('settings')}
      >
        <Settings className="w-4 h-4" />
        {!collapsed && <span className="text-xs">{tCommon('settings')}</span>}
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" sideOffset={8} align="end" className="w-44">
        {/* Theme submenu */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            {THEME_ICONS[theme as Theme]}
            <span>{tSettings('theme')}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {THEME_KEYS.map((value) => (
              <DropdownMenuItem key={value} onClick={() => setTheme(value)}>
                {THEME_ICONS[value]}
                <span>{tSettings(value)}</span>
                {theme === value && <Check className="ml-auto w-3.5 h-3.5 text-muted-foreground" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {/* Language submenu */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Languages className="w-4 h-4" />
            <span>{tSettings('language')}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {LANGUAGE_OPTIONS.map((opt) => (
              <DropdownMenuItem key={opt.value} onClick={() => i18n.changeLanguage(opt.value)}>
                <span>{opt.flag}</span>
                <span>{opt.label}</span>
                {i18n.language === opt.value && <Check className="ml-auto w-3.5 h-3.5 text-muted-foreground" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Drop zone shown during drag operations */
function DropZone({
  type,
  collapsed,
  label,
  onDrop,
}: {
  type: 'pin' | 'archive'
  collapsed: boolean
  label: string
  onDrop: (panelId: string) => void
}) {
  const [isOver, setIsOver] = useState(false)

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setIsOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsOver(false)
      const panelId = e.dataTransfer.getData('text/plain')
      if (panelId) onDrop(panelId)
    },
    [onDrop],
  )

  const isPinZone = type === 'pin'

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        'flex items-center justify-center gap-1.5 rounded-lg border-2 border-dashed transition-all duration-200',
        collapsed ? 'mx-1 py-2' : 'mx-2 py-3',
        isPinZone
          ? cn(
              'border-primary/50 bg-primary/5',
              isOver && 'bg-primary/20 border-primary/80',
            )
          : cn(
              'border-panel-status-warning/50 bg-panel-status-warning/5',
              isOver && 'bg-panel-status-warning/20 border-panel-status-warning/80',
            ),
      )}
    >
      {isPinZone ? (
        <Pin className={cn('w-3.5 h-3.5', isOver ? 'text-primary' : 'text-primary/60')} />
      ) : (
        <Archive className={cn('w-3.5 h-3.5', isOver ? 'text-panel-status-warning' : 'text-panel-status-warning/60')} />
      )}
      {!collapsed && (
        <span
          className={cn(
            'text-xs font-medium',
            isPinZone
              ? isOver ? 'text-primary' : 'text-primary/60'
              : isOver ? 'text-panel-status-warning' : 'text-panel-status-warning/60',
          )}
        >
          {label}
        </span>
      )}
    </div>
  )
}

export function Sidebar() {
  const { t } = useTranslation('sidebar')
  const [collapsed, setCollapsed] = useState(false)
  const [draggedPanelId, setDraggedPanelId] = useState<string | null>(null)
  const panels = useCanvasStore((s) => s.panels)
  const pinPanel = useCanvasStore((s) => s.pinPanel)
  const archivePanel = useCanvasStore((s) => s.archivePanel)

  const pinnedPanels = panels.filter((p) => p.pinned)
  const unpinnedPanels = panels.filter((p) => !p.pinned)

  const isDragging = draggedPanelId !== null

  const handleDragStart = useCallback((panelId: string) => {
    setDraggedPanelId(panelId)
  }, [])

  const handleDragEnd = useCallback(() => {
    setDraggedPanelId(null)
  }, [])

  const handlePinDrop = useCallback(
    (panelId: string) => {
      const panel = panels.find((p) => p.panelId === panelId)
      if (!panel) return
      if (!panel.pinned) {
        pinPanel(panelId)
        toast.success(t('pinned_toast', { title: panel.title }))
      }
      setDraggedPanelId(null)
    },
    [panels, pinPanel, t],
  )

  const handleArchiveDrop = useCallback(
    (panelId: string) => {
      const panel = panels.find((p) => p.panelId === panelId)
      if (!panel) return
      archivePanel(panelId)
      toast.success(t('archived_toast', { title: panel.title }))
      setDraggedPanelId(null)
    },
    [panels, archivePanel],
  )

  return (
    <aside
      aria-label={t('app_name')}
      className={cn(
        'flex flex-col h-full bg-muted/30 border-r border-border/50 shrink-0 transition-all duration-300',
        collapsed ? 'w-12' : 'w-48 lg:w-56',
      )}
    >
      {/* Top: App name + collapse toggle */}
      <div className="flex items-center justify-between px-3 py-3 shrink-0">
        {!collapsed && (
          <span className="text-sm font-semibold truncate">
            {t('app_name')}
          </span>
        )}
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => setCollapsed((v) => !v)}
          className="shrink-0"
          title={collapsed ? t('expand') : t('collapse')}
          aria-label={collapsed ? t('expand') : t('collapse')}
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </Button>
      </div>

      {/* Pin drop zone — visible only during drag */}
      <div
        className={cn(
          'shrink-0 overflow-hidden transition-all duration-200',
          isDragging ? 'max-h-20 opacity-100 py-1' : 'max-h-0 opacity-0 py-0',
        )}
      >
        <DropZone type="pin" collapsed={collapsed} label={t('drop_to_pin')} onDrop={handlePinDrop} />
      </div>

      {/* Panel list */}
      <ScrollArea className="flex-1 min-h-0">
        <div className={cn('space-y-1', collapsed ? 'px-1' : 'px-2')}>
          {/* Pinned section */}
          {pinnedPanels.length > 0 && (
            <div>
              {!collapsed && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground px-2 py-1.5 font-medium">
                  <Pin className="w-3 h-3" /> {t('pinned')}
                </div>
              )}
              {pinnedPanels.map((panel) => (
                <SidebarPanelItem
                  key={panel.panelId}
                  panel={panel}
                  collapsed={collapsed}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  isDragged={draggedPanelId === panel.panelId}
                />
              ))}
            </div>
          )}

          {/* Unpinned section */}
          {unpinnedPanels.length > 0 && (
            <div>
              {!collapsed && (
                <div className="text-xs text-muted-foreground px-2 py-1.5 font-medium mt-2">
                  {t('temporary')}
                </div>
              )}
              {unpinnedPanels.map((panel) => (
                <SidebarPanelItem
                  key={panel.panelId}
                  panel={panel}
                  collapsed={collapsed}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  isDragged={draggedPanelId === panel.panelId}
                />
              ))}
            </div>
          )}

          {panels.length === 0 && !collapsed && (
            <div className="text-xs text-muted-foreground text-center py-8">
              {t('no_panels')}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Archive drop zone — visible only during drag, placed above the bottom area */}
      <div
        className={cn(
          'shrink-0 overflow-hidden transition-all duration-200',
          isDragging ? 'max-h-20 opacity-100 py-1' : 'max-h-0 opacity-0 py-0',
        )}
      >
        <DropZone type="archive" collapsed={collapsed} label={t('drop_to_archive')} onDrop={handleArchiveDrop} />
      </div>

    </aside>
  )
}
