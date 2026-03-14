import { useCallback, useMemo, type ReactNode } from 'react'
import { Responsive, WidthProvider } from 'react-grid-layout/legacy'
import 'react-grid-layout/css/styles.css'
import { useCanvasStore } from '@/stores/canvas-store'
import type { PanelState, PanelLayoutPosition } from '@/types/store'
import {
  PANEL_SIZE_COLS,
  PANEL_SIZE_ROWS,
  PANEL_TYPE_DEFAULT_W,
  PANEL_TYPE_DEFAULT_H,
} from '@/types/layout'
import type { LayoutItem } from 'react-grid-layout/legacy'

const ResponsiveGridLayout = WidthProvider(Responsive)

interface GridLayoutProps {
  panels: PanelState[]
  children: ReactNode
  className?: string
}

/** Get default width for a panel based on panelType, falling back to size */
function defaultW(panel: PanelState): number {
  return PANEL_TYPE_DEFAULT_W[panel.panelType] ?? PANEL_SIZE_COLS[panel.size]
}

/** Get default height for a panel based on panelType, falling back to size */
function defaultH(panel: PanelState): number {
  return PANEL_TYPE_DEFAULT_H[panel.panelType] ?? PANEL_SIZE_ROWS[panel.size]
}

/**
 * Build layout from stored positions + compute defaults for new panels.
 * Stored panels keep their positions; new panels pack at the bottom.
 */
function buildLayout(
  panels: PanelState[],
  stored: Record<string, PanelLayoutPosition>,
  maxCols: number,
): LayoutItem[] {
  const layouts: LayoutItem[] = []

  // First pass: place panels with stored positions
  let maxBottom = 0
  for (const panel of panels) {
    const pos = stored[panel.panelId]
    if (pos) {
      const w = Math.min(pos.w, maxCols)
      const x = Math.min(pos.x, maxCols - w)
      layouts.push({
        i: panel.panelId,
        x,
        y: pos.y,
        w,
        h: pos.h,
        minW: Math.min(3, maxCols),
        minH: 2,
      })
      maxBottom = Math.max(maxBottom, pos.y + pos.h)
    }
  }

  // Second pass: pack new panels (no stored position) left-to-right below existing
  let curX = 0
  let curY = maxBottom
  let rowMaxH = 0

  for (const panel of panels) {
    if (stored[panel.panelId]) continue

    const w = Math.min(defaultW(panel), maxCols)
    const h = defaultH(panel)

    if (curX + w > maxCols) {
      curX = 0
      curY += rowMaxH
      rowMaxH = 0
    }

    layouts.push({
      i: panel.panelId,
      x: curX,
      y: curY,
      w,
      h,
      minW: Math.min(3, maxCols),
      minH: 2,
    })

    curX += w
    rowMaxH = Math.max(rowMaxH, h)
  }

  return layouts
}

export function GridLayout({ panels, children, className }: GridLayoutProps) {
  const gridConfig = useCanvasStore((s) => s.gridConfig)
  const panelLayouts = useCanvasStore((s) => s.panelLayouts)
  const setPanelLayouts = useCanvasStore((s) => s.setPanelLayouts)

  /** Save full layout to store — only called from user drag/resize stop events */
  const saveLayout = useCallback(
    (layout: readonly { i: string; x: number; y: number; w: number; h: number }[]) => {
      const newPositions: Record<string, PanelLayoutPosition> = {}
      for (const item of layout) {
        newPositions[item.i] = { x: item.x, y: item.y, w: item.w, h: item.h }
      }
      setPanelLayouts(newPositions)
    },
    [setPanelLayouts],
  )

  const colsMap = { lg: 18, md: 15, sm: 9, xs: 6, xxs: 3 }

  // panelLayouts in deps ensures the memoized layout stays in sync after drag/resize.
  // No infinite loop because we only write to the store from onDragStop/onResizeStop
  // (user-initiated), not from onLayoutChange (which fires on prop changes too).
  const layouts = useMemo(
    () => ({
      lg: buildLayout(panels, panelLayouts, colsMap.lg),
      md: buildLayout(panels, panelLayouts, colsMap.md),
      sm: buildLayout(panels, panelLayouts, colsMap.sm),
      xs: buildLayout(panels, panelLayouts, colsMap.xs),
      xxs: buildLayout(panels, panelLayouts, colsMap.xxs),
    }),
    [panels, panelLayouts],
  )

  return (
    <ResponsiveGridLayout
      className={className}
      layouts={layouts}
      breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
      cols={{ lg: 18, md: 15, sm: 9, xs: 6, xxs: 3 }}
      rowHeight={gridConfig.rowHeight}
      margin={[...gridConfig.margin]}
      containerPadding={[...gridConfig.containerPadding]}
      isDraggable
      isResizable
      compactType="vertical"
      draggableCancel="button, a, input, textarea, select, [role='menuitem'], [data-slot='dropdown-menu-item'], [data-no-drag]"
      onDragStop={(layout) => saveLayout(layout)}
      onResizeStop={(layout) => saveLayout(layout)}
    >
      {children}
    </ResponsiveGridLayout>
  )
}
