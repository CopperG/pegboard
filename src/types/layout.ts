// Layout types (Spec §8.2, Phase 2 Notion-style overhaul)

/** @deprecated Phase 1 layout mode — kept for migration, use CanvasView instead */
export type LayoutMode = 'chat' | 'workspace' | 'dashboard'

/** Phase 2 canvas view tabs — category-based filtering via panel tags */
export type CanvasView = 'important' | 'daily' | 'work' | 'entertainment' | 'other' | 'all'

/** Ordered list of category tabs */
export const CANVAS_VIEW_ORDER: CanvasView[] = ['important', 'daily', 'work', 'entertainment', 'other', 'all']

/** Category tag values that correspond to each tab (used for filtering) */
export const CATEGORY_TAGS: Record<Exclude<CanvasView, 'all'>, string> = {
  important: 'important',
  daily: 'daily',
  work: 'work',
  entertainment: 'entertainment',
  other: 'other',
}

export type PanelSize = 'sm' | 'md' | 'lg' | 'full'

/** Grid column mapping for panel sizes */
export const PANEL_SIZE_COLS: Record<PanelSize, number> = {
  sm: 5,
  md: 6,
  lg: 9,
  full: 18,
}

/** Default grid-row height per panel size */
export const PANEL_SIZE_ROWS: Record<PanelSize, number> = {
  sm: 3,
  md: 3,
  lg: 4,
  full: 4,
}

/** Default grid-column width per panelType (overrides PANEL_SIZE_COLS when no stored layout) */
export const PANEL_TYPE_DEFAULT_W: Record<string, number> = {
  html: 6,
  chart: 6,
  table: 6,
  timeline: 6,
  text: 5,
  list: 4,
  image: 4,
  code: 5,
  kv: 4,
}

/** Default grid-row height per panelType (overrides PANEL_SIZE_ROWS when no stored layout) */
export const PANEL_TYPE_DEFAULT_H: Record<string, number> = {
  html: 6,
  chart: 5,
  timeline: 5,
  image: 5,
  table: 5,
  text: 5,
  list: 5,
  code: 5,
  kv: 5,
}

export interface GridLayoutConfig {
  cols: number
  rowHeight: number
  margin: [number, number]
  containerPadding: [number, number]
}

export const DEFAULT_GRID_CONFIG: GridLayoutConfig = {
  cols: 18,
  rowHeight: 50,
  margin: [10, 10],
  containerPadding: [12, 12],
}

/** Sidebar state for Notion-style layout */
export interface SidebarState {
  collapsed: boolean
}
