import { useMemo, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowUpDown, ArrowUp, ArrowDown, Filter, X } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useCanvasStore, selectPanelInteraction } from '@/stores/canvas-store'
import type { PanelProps } from './PanelRegistry'

interface TableColumn {
  key: string
  label: string
  align?: 'left' | 'center' | 'right'
  format?: 'text' | 'number' | 'currency' | 'percent' | 'date'
  width?: number
}

interface TablePanelData {
  columns: TableColumn[]
  rows: Array<Record<string, unknown>>
  footer?: Record<string, unknown>
}

function isTablePanelData(data: unknown): data is TablePanelData {
  if (data == null || typeof data !== 'object') return false
  const obj = data as Record<string, unknown>
  return Array.isArray(obj['columns']) && Array.isArray(obj['rows'])
}

const alignClass: Record<string, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
}

function formatValue(value: unknown, format?: string): string {
  if (value == null) return ''

  switch (format) {
    case 'number': {
      const num = Number(value)
      if (Number.isNaN(num)) return String(value)
      return new Intl.NumberFormat().format(num)
    }
    case 'currency': {
      const num = Number(value)
      if (Number.isNaN(num)) return String(value)
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: 'CNY',
      }).format(num)
    }
    case 'percent': {
      const num = Number(value)
      if (Number.isNaN(num)) return String(value)
      return new Intl.NumberFormat(undefined, {
        style: 'percent',
      }).format(num)
    }
    case 'date': {
      const date = new Date(String(value))
      if (Number.isNaN(date.getTime())) return String(value)
      return new Intl.DateTimeFormat(undefined).format(date)
    }
    default:
      return String(value)
  }
}

// ── Sort & Filter Types ──────────────────────────────────────────────

interface SortConfig {
  key: string
  direction: 'asc' | 'desc'
}

interface FilterState {
  text?: string
  min?: number
  max?: number
  selectedValues?: Set<string>
}

function isNumericFormat(format?: string): boolean {
  return format === 'number' || format === 'currency' || format === 'percent'
}

function getNumericValue(value: unknown): number {
  const num = Number(value)
  return Number.isNaN(num) ? 0 : num
}

// ── Filter Popover ───────────────────────────────────────────────────

function FilterPopoverContent({
  column,
  rows,
  filter,
  onChange,
  onClear,
}: {
  column: TableColumn
  rows: Array<Record<string, unknown>>
  filter: FilterState | undefined
  onChange: (filter: FilterState) => void
  onClear: () => void
}) {
  const { t } = useTranslation('panels')
  const { t: tCommon } = useTranslation('common')
  const format = column.format ?? 'text'
  const isNumeric = isNumericFormat(format)

  // Collect unique values for status-like columns
  const uniqueValues = useMemo(() => {
    if (isNumeric || format === 'date') return null
    const vals = new Set<string>()
    for (const row of rows) {
      const v = row[column.key]
      if (v != null) vals.add(String(v))
    }
    // Only show as multi-select if there are a manageable number of unique values
    if (vals.size > 0 && vals.size <= 20) return [...vals].sort()
    return null
  }, [rows, column.key, isNumeric, format])

  if (isNumeric) {
    return (
      <div className="flex flex-col gap-2 p-1">
        <div className="text-xs font-medium text-muted-foreground">{t('range_filter')}</div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            placeholder={t('min')}
            className="w-20 rounded border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary/50"
            value={filter?.min ?? ''}
            onChange={(e) =>
              onChange({
                ...filter,
                min: e.target.value === '' ? undefined : Number(e.target.value),
              })
            }
          />
          <span className="text-xs text-muted-foreground">—</span>
          <input
            type="number"
            placeholder={t('max')}
            className="w-20 rounded border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary/50"
            value={filter?.max ?? ''}
            onChange={(e) =>
              onChange({
                ...filter,
                max: e.target.value === '' ? undefined : Number(e.target.value),
              })
            }
          />
        </div>
        <button
          className="mt-1 text-xs text-muted-foreground hover:text-foreground transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none rounded"
          onClick={onClear}
        >
          {tCommon('clear_filter')}
        </button>
      </div>
    )
  }

  // If we have a small set of unique values, show multi-select checkboxes
  if (uniqueValues) {
    const selected = filter?.selectedValues ?? new Set<string>()
    return (
      <div className="flex flex-col gap-1 p-1 max-h-60 overflow-y-auto">
        <div className="text-xs font-medium text-muted-foreground mb-1">{t('select_values')}</div>
        {uniqueValues.map((val) => (
          <label
            key={val}
            className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5 transition-colors"
          >
            <input
              type="checkbox"
              className="rounded border-muted-foreground"
              checked={selected.has(val)}
              onChange={(e) => {
                const next = new Set(selected)
                if (e.target.checked) {
                  next.add(val)
                } else {
                  next.delete(val)
                }
                onChange({ ...filter, selectedValues: next.size > 0 ? next : undefined })
              }}
            />
            <span className="truncate">{val}</span>
          </label>
        ))}
        <button
          className="mt-1 text-xs text-muted-foreground hover:text-foreground transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none rounded"
          onClick={onClear}
        >
          {tCommon('clear_filter')}
        </button>
      </div>
    )
  }

  // Default: text contains search
  return (
    <div className="flex flex-col gap-2 p-1">
      <div className="text-xs font-medium text-muted-foreground">{t('contains')}</div>
      <input
        type="text"
        placeholder={t('search_placeholder')}
        className="w-full rounded border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary/50"
        value={filter?.text ?? ''}
        onChange={(e) =>
          onChange({
            ...filter,
            text: e.target.value || undefined,
          })
        }
      />
      <button
        className="mt-1 text-xs text-muted-foreground hover:text-foreground transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none rounded"
        onClick={onClear}
      >
        {tCommon('clear_filter')}
      </button>
    </div>
  )
}

// ── Column Header ────────────────────────────────────────────────────

function ColumnHeader({
  column,
  rows,
  sortable,
  filterable,
  sortConfig,
  filter,
  onSort,
  onFilterChange,
  onFilterClear,
}: {
  column: TableColumn
  rows: Array<Record<string, unknown>>
  sortable: boolean
  filterable: boolean
  sortConfig: SortConfig | null
  filter: FilterState | undefined
  onSort: (key: string) => void
  onFilterChange: (key: string, filter: FilterState) => void
  onFilterClear: (key: string) => void
}) {
  const isSorted = sortConfig?.key === column.key
  const hasActiveFilter = filter != null && (
    (filter.text != null && filter.text !== '') ||
    filter.min != null ||
    filter.max != null ||
    (filter.selectedValues != null && filter.selectedValues.size > 0)
  )

  const SortIcon = isSorted
    ? sortConfig.direction === 'asc'
      ? ArrowUp
      : ArrowDown
    : ArrowUpDown

  return (
    <th
      key={column.key}
      className={`px-2.5 py-1.5 text-xs font-medium text-muted-foreground ${alignClass[column.align ?? 'left'] ?? 'text-left'}`}
      style={column.width ? { width: column.width } : undefined}
    >
      <div className="flex items-center gap-1 group">
        {sortable ? (
          <button
            className="flex items-center gap-1 hover:text-foreground transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none rounded"
            onClick={() => onSort(column.key)}
          >
            <span>{column.label}</span>
            <SortIcon
              className={`w-3.5 h-3.5 shrink-0 ${
                isSorted ? 'text-primary' : 'text-muted-foreground opacity-0 group-hover:opacity-100'
              } transition-opacity`}
            />
          </button>
        ) : (
          <span>{column.label}</span>
        )}

        {filterable && (
          <Popover>
            <PopoverTrigger
              className={`ml-auto shrink-0 p-0.5 rounded hover:bg-muted/50 transition-colors ${
                hasActiveFilter
                  ? 'text-primary'
                  : 'text-muted-foreground opacity-0 group-hover:opacity-100'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
            </PopoverTrigger>
            <PopoverContent align="start" className="w-56">
              <FilterPopoverContent
                column={column}
                rows={rows}
                filter={filter}
                onChange={(f) => onFilterChange(column.key, f)}
                onClear={() => onFilterClear(column.key)}
              />
            </PopoverContent>
          </Popover>
        )}
      </div>
    </th>
  )
}

// ── Main TablePanel ──────────────────────────────────────────────────

export function TablePanel({ panelId, data }: PanelProps) {
  const { t } = useTranslation('panels')
  const { t: tCommon } = useTranslation('common')
  const interaction = useCanvasStore(selectPanelInteraction(panelId))

  const sortable = interaction?.sortable ?? false
  const filterable = interaction?.filterable ?? false

  const panelData = useMemo<TablePanelData | null>(() => {
    if (isTablePanelData(data)) return data
    return null
  }, [data])

  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null)
  const [filters, setFilters] = useState<Record<string, FilterState>>({})

  const handleSort = useCallback(
    (key: string) => {
      setSortConfig((prev) => {
        if (!prev || prev.key !== key) return { key, direction: 'asc' }
        if (prev.direction === 'asc') return { key, direction: 'desc' }
        return null // cycle back to none
      })
    },
    [],
  )

  const handleFilterChange = useCallback(
    (key: string, filter: FilterState) => {
      setFilters((prev) => ({ ...prev, [key]: filter }))
    },
    [],
  )

  const handleFilterClear = useCallback(
    (key: string) => {
      setFilters((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    },
    [],
  )

  // Filter rows
  const filteredRows = useMemo(() => {
    if (!panelData) return []
    const { rows, columns } = panelData
    const activeFilters = Object.entries(filters)
    if (activeFilters.length === 0) return rows

    return rows.filter((row) =>
      activeFilters.every(([key, filter]) => {
        const value = row[key]
        const col = columns.find((c) => c.key === key)
        const format = col?.format ?? 'text'
        const isNumeric = isNumericFormat(format)

        // Numeric range filter
        if (isNumeric && (filter.min != null || filter.max != null)) {
          const num = getNumericValue(value)
          if (filter.min != null && num < filter.min) return false
          if (filter.max != null && num > filter.max) return false
          return true
        }

        // Multi-select filter
        if (filter.selectedValues && filter.selectedValues.size > 0) {
          return filter.selectedValues.has(String(value ?? ''))
        }

        // Text contains filter
        if (filter.text) {
          return String(value ?? '')
            .toLowerCase()
            .includes(filter.text.toLowerCase())
        }

        return true
      }),
    )
  }, [panelData, filters])

  // Sort filtered rows
  const sortedRows = useMemo(() => {
    if (!sortConfig || !panelData) return filteredRows
    const col = panelData.columns.find((c) => c.key === sortConfig.key)
    const format = col?.format ?? 'text'
    const dir = sortConfig.direction === 'asc' ? 1 : -1

    return [...filteredRows].sort((a, b) => {
      const va = a[sortConfig.key]
      const vb = b[sortConfig.key]

      if (va == null && vb == null) return 0
      if (va == null) return 1
      if (vb == null) return -1

      if (isNumericFormat(format)) {
        return (getNumericValue(va) - getNumericValue(vb)) * dir
      }

      if (format === 'date') {
        const da = new Date(String(va)).getTime()
        const db = new Date(String(vb)).getTime()
        if (!Number.isNaN(da) && !Number.isNaN(db)) return (da - db) * dir
      }

      return String(va).localeCompare(String(vb)) * dir
    })
  }, [filteredRows, sortConfig, panelData])

  if (!panelData) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        {t('cannot_render', { type: t('table') })}: {t('invalid_data')} (panelId: {panelId})
      </div>
    )
  }

  const { columns, rows, footer } = panelData
  const hasActiveFilters = Object.keys(filters).length > 0
  const isFiltered = hasActiveFilters && sortedRows.length !== rows.length

  return (
    <div className="overflow-auto h-full [mask-image:linear-gradient(to_right,black_90%,transparent)] hover:[mask-image:none] focus-within:[mask-image:none]">
      {isFiltered && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/40 border-b text-xs text-muted-foreground">
          <span>
            {t('filter_active', { shown: sortedRows.length, total: rows.length })}
          </span>
          <button
            className="inline-flex items-center gap-0.5 text-primary hover:text-primary/80 transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none rounded"
            onClick={() => setFilters({})}
          >
            <X className="w-3 h-3" />
            {tCommon('clear_all_filters')}
          </button>
        </div>
      )}
      <table className="w-full text-xs">
        <thead className="sticky top-0 z-10">
          <tr className="border-b bg-muted/40 backdrop-blur-sm">
            {columns.map((col) => (
              <ColumnHeader
                key={col.key}
                column={col}
                rows={rows}
                sortable={sortable}
                filterable={filterable}
                sortConfig={sortConfig}
                filter={filters[col.key]}
                onSort={handleSort}
                onFilterChange={handleFilterChange}
                onFilterClear={handleFilterClear}
              />
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row, rowIdx) => (
            <tr
              key={rowIdx}
              className="border-b border-border/15 even:bg-muted/30 hover:bg-muted/20 transition-colors"
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`px-2.5 py-1.5 text-xs ${alignClass[col.align ?? 'left'] ?? 'text-left'}${isNumericFormat(col.format) || col.format === 'date' ? ' tabular-nums font-mono' : ' max-w-[200px] truncate'}`}
                >
                  {formatValue(row[col.key], col.format)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {footer && (
          <tfoot>
            <tr className="border-t border-border/50 font-semibold">
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`px-2.5 py-1.5 text-xs ${alignClass[col.align ?? 'left'] ?? 'text-left'}`}
                >
                  {formatValue(footer[col.key], col.format)}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
