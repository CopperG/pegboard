import { useState, useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import type { PanelSize } from '@/types/layout'
import { useCanvasStore, selectPanelStarred } from '@/stores/canvas-store'
import { getPanelIcon } from '@/lib/panel-icons'
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import {
  Pin, Star, Archive, Search, MoreHorizontal, X,
} from 'lucide-react'
import { setIframeLayerExpanded } from './SandboxRenderer'

const actionItemClass =
  'flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-sm select-none hover:bg-accent hover:text-accent-foreground transition-colors'

/**
 * Panel actions popover — uses Popover + native <button> elements instead of
 * DropdownMenu to avoid Base UI Menu.Item event handling issues inside
 * react-grid-layout (portal events bubble through React tree but DraggableCore's
 * cancel check walks the DOM tree, so it can't match portal-rendered elements).
 */
function PanelActionsMenu({
  pinned,
  starred,
  onPin,
  onStar,
  onArchive,
  onExpand,
}: {
  pinned: boolean
  starred: boolean
  onPin: () => void
  onStar: () => void
  onArchive: () => void
  onExpand: () => void
}) {
  const { t } = useTranslation('panels')
  const [open, setOpen] = useState(false)

  const act = (fn: () => void) => {
    fn()
    setOpen(false)
  }

  return (
    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button variant="ghost" size="icon-xs" className="shrink-0" aria-label={t('panel_actions', { ns: 'common' })}>
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          }
        />
        <PopoverContent
          align="end"
          sideOffset={4}
          className="w-auto min-w-[140px] p-1 gap-0"
        >
          {/* Native buttons — immune to DraggableCore interference */}
          <button type="button" className={actionItemClass} onClick={() => act(onPin)}>
            <Pin className="w-3.5 h-3.5 shrink-0" />
            {pinned ? t('unpin') : t('pin')}
          </button>
          <button type="button" className={actionItemClass} onClick={() => act(onStar)}>
            <Star className="w-3.5 h-3.5 shrink-0" />
            {starred ? t('unstar') : t('star')}
          </button>
          <button type="button" className={actionItemClass} onClick={() => act(onArchive)}>
            <Archive className="w-3.5 h-3.5 shrink-0" />
            {t('archive')}
          </button>
          <button type="button" className={actionItemClass} onClick={() => act(onExpand)}>
            <Search className="w-3.5 h-3.5 shrink-0" />
            {t('expand_view')}
          </button>
        </PopoverContent>
      </Popover>
    </div>
  )
}

interface PanelShellProps {
  panelId: string
  title: string
  subtitle?: string
  size: PanelSize
  pinned: boolean
  focused?: boolean
  isHtmlPanel?: boolean
  panelType?: string
  children: React.ReactNode
}

export function PanelShell({
  panelId,
  title,
  subtitle,
  pinned,
  focused,
  isHtmlPanel,
  panelType,
  children,
}: PanelShellProps) {
  const [expanded, setExpanded] = useState(false)
  const starred = useCanvasStore(selectPanelStarred(panelId))

  const shellRef = useRef<HTMLDivElement>(null)
  const panelIcon = panelType ? getPanelIcon(panelType) : null

  // Scroll into view when focused (e.g. from sidebar click)
  useEffect(() => {
    if (focused && shellRef.current) {
      // Use requestAnimationFrame to wait for any tab switch / layout to settle
      requestAnimationFrame(() => {
        shellRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
    }
  }, [focused])

  const handlePin = useCallback(() => {
    if (pinned) {
      useCanvasStore.getState().unpinPanel(panelId)
    } else {
      useCanvasStore.getState().pinPanel(panelId)
    }
  }, [panelId, pinned])

  const handleStar = useCallback(() => {
    useCanvasStore.getState().toggleStar(panelId)
  }, [panelId])

  const handleArchive = useCallback(() => {
    useCanvasStore.getState().archivePanel(panelId)
  }, [panelId])

  // Bump iframe layer z-index above overlay when HTML panel is expanded
  useEffect(() => {
    if (expanded && isHtmlPanel) {
      setIframeLayerExpanded(true)
      return () => setIframeLayerExpanded(false)
    }
  }, [expanded, isHtmlPanel])

  return (
    <div
      ref={shellRef}
      data-panel
      data-panel-type={panelType}
      className={`group h-full flex flex-col relative ${
        focused ? 'ring-2 ring-primary/50 shadow-lg shadow-primary/10' : ''
      }`}
    >
      {/* Focus pulse overlay */}
      <AnimatePresence>
        {focused && (
          <motion.div
            key="focus-pulse"
            className="absolute inset-0 rounded-xl ring-2 ring-primary/40 pointer-events-none z-10"
            initial={{ scale: 1.03, opacity: 0.5 }}
            animate={{ scale: 1, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
          />
        )}
      </AnimatePresence>

      {/* Title bar — double-click to expand */}
      {panelType === 'image' ? (
        <>
          {/* Image: overlay title bar */}
          <div
            data-panel-header
            className="absolute top-0 left-0 right-0 z-10 flex items-center px-3 py-2 bg-gradient-to-b from-panel-overlay/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
            onDoubleClick={() => setExpanded(true)}
          >
            {panelIcon && (
              <span
                className="text-panel-overlay-text/80 mr-2 shrink-0 cursor-grab active:cursor-grabbing drop-shadow-sm"
                draggable
                data-no-drag
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/panel-id', panelId)
                  e.dataTransfer.effectAllowed = 'link'
                }}
              >
                {panelIcon}
              </span>
            )}
            <span className="font-medium text-sm truncate text-panel-overlay-text drop-shadow-sm" role="heading" aria-level={3}>{title}</span>
            {starred && (
              <Star className="w-3.5 h-3.5 text-panel-star fill-panel-star ml-1 shrink-0 drop-shadow-sm" />
            )}
            <span className="flex-1" />
            <PanelActionsMenu
              pinned={pinned}
              starred={starred}
              onPin={handlePin}
              onStar={handleStar}
              onArchive={handleArchive}
              onExpand={() => setExpanded(true)}
            />
          </div>
          {/* Image: edge-to-edge content */}
          <div className="flex-1 overflow-hidden">
            {children}
          </div>
        </>
      ) : (
        <>
          <div
            data-panel-header
            className="flex items-center px-3 py-2 shrink-0"
            onDoubleClick={() => setExpanded(true)}
          >
            {panelIcon && (
              <span
                className="text-muted-foreground mr-2 shrink-0 cursor-grab active:cursor-grabbing"
                draggable
                data-no-drag
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/panel-id', panelId)
                  e.dataTransfer.effectAllowed = 'link'
                }}
              >
                {panelIcon}
              </span>
            )}
            <span className="font-medium text-sm truncate text-balance" role="heading" aria-level={3}>{title}</span>
            {starred && (
              <Star className="w-3.5 h-3.5 text-panel-star fill-panel-star ml-1 shrink-0" />
            )}
            {isHtmlPanel && (
              <span className="text-[10px] bg-primary/10 text-muted-foreground px-1.5 py-0.5 rounded font-mono ml-2 shrink-0">
                HTML
              </span>
            )}
            {subtitle && (
              <span className="text-xs text-muted-foreground ml-2 truncate">
                {subtitle}
              </span>
            )}
            <span className="flex-1" />
            <PanelActionsMenu
              pinned={pinned}
              starred={starred}
              onPin={handlePin}
              onStar={handleStar}
              onArchive={handleArchive}
              onExpand={() => setExpanded(true)}
            />
          </div>

          {/* Content area — hide HTML panel children when expanded to avoid dual SandboxRenderer */}
          <div className={`flex-1 px-3 pb-3 overflow-hidden ${isHtmlPanel ? 'min-h-0' : 'overflow-auto'}`}>
            {!(expanded && isHtmlPanel) && children}
          </div>
        </>
      )}

      {/* Fullscreen expand overlay */}
      <ExpandOverlay
        expanded={expanded}
        title={title}
        panelIcon={panelIcon}
        isHtmlPanel={isHtmlPanel}
        onClose={() => setExpanded(false)}
      >
        {children}
      </ExpandOverlay>
    </div>
  )
}

/** Fullscreen overlay rendered via React Portal with FLIP-style animation */
function ExpandOverlay({
  expanded,
  title,
  panelIcon,
  isHtmlPanel,
  onClose,
  children,
}: {
  expanded: boolean
  title: string
  panelIcon?: React.ReactNode
  isHtmlPanel?: boolean
  onClose: () => void
  children: React.ReactNode
}) {
  const { t: tCommon } = useTranslation('common')
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!expanded) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [expanded, onClose])

  // Focus the overlay container when opened
  useEffect(() => {
    if (expanded && overlayRef.current) {
      overlayRef.current.focus()
    }
  }, [expanded])

  const springTransition = { type: 'spring' as const, stiffness: 400, damping: 30 }

  return createPortal(
    <AnimatePresence>
      {expanded && (
        <motion.div
          key="expand-backdrop"
          data-no-swipe
          className="fixed inset-0 z-[100] flex items-center justify-center bg-panel-overlay/60"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseMove={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerMove={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <motion.div
            ref={overlayRef}
            tabIndex={-1}
            role="dialog"
            aria-label={title}
            className="relative w-[90vw] h-[90vh] max-w-[1200px] bg-card rounded-xl overflow-hidden shadow-2xl flex flex-col outline-none"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={springTransition}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center px-6 py-4 border-b sticky top-0 bg-card z-10">
              {panelIcon && (
                <span className="text-muted-foreground mr-2 shrink-0">
                  {panelIcon}
                </span>
              )}
              <span className="font-medium text-base truncate">{title}</span>
              <span className="flex-1" />
              <button
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                aria-label={tCommon('close')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* Content — no padding for HTML panels so iframe fills the space */}
            <div className={`flex-1 min-h-0 ${isHtmlPanel ? 'overflow-hidden' : 'p-6 overflow-auto'}`}>{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
