import { useMemo, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import {
  LineChart,
  BarChart,
  PieChart,
  AreaChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Line,
  Bar,
  Pie,
  Area,
  Cell,
} from 'recharts'
import type { PanelProps } from './PanelRegistry'
import type { ChartPanelData } from '@/types/panel-data'

/** Fallback colors in case CSS variables cannot be read */
const FALLBACK_COLORS = [
  '#8884d8',
  '#82ca9d',
  '#ffc658',
  '#ff7300',
  '#0088fe',
  '#00C49F',
  '#FFBB28',
  '#FF8042',
]

/** Shared tooltip style using CSS variables (theme-aware) */
const TOOLTIP_STYLE: React.CSSProperties = {
  backgroundColor: 'var(--color-popover)',
  border: '1px solid var(--color-border)',
  borderRadius: '0.625rem',
  color: 'var(--color-popover-foreground)',
  fontSize: 11,
  padding: '6px 10px',
  boxShadow: '0 4px 12px oklch(0 0 0 / 10%)',
}

const CHART_VAR_NAMES = [
  '--color-chart-1',
  '--color-chart-2',
  '--color-chart-3',
  '--color-chart-4',
  '--color-chart-5',
]

/** Read computed chart colors from CSS custom properties */
function readChartColors(): string[] {
  const styles = getComputedStyle(document.documentElement)
  const colors: string[] = []
  for (const name of CHART_VAR_NAMES) {
    const val = styles.getPropertyValue(name).trim()
    if (val) {
      colors.push(val)
    }
  }
  return colors.length > 0 ? colors : FALLBACK_COLORS
}

/** Hook that re-reads chart CSS vars when the theme changes */
function useChartColors() {
  const { resolved } = useTheme()
  const [colors, setColors] = useState<string[]>(FALLBACK_COLORS)

  useEffect(() => {
    // Small delay to let CSS variables settle after class change
    const id = requestAnimationFrame(() => {
      setColors(readChartColors())
    })
    return () => cancelAnimationFrame(id)
  }, [resolved])

  return colors
}

function isChartPanelData(data: unknown): data is ChartPanelData {
  if (data == null || typeof data !== 'object') return false
  const obj = data as Record<string, unknown>
  return (
    typeof obj['chartType'] === 'string' &&
    Array.isArray(obj['data'])
  )
}

/**
 * Transform the ChartPanelData.data (array of { label, value, series? })
 * into Recharts-friendly format depending on chart type.
 *
 * For pie charts: use as-is (label + value).
 * For cartesian charts with series: pivot so each row is { [xAxis]: label, [series1]: value, [series2]: value, ... }.
 * For cartesian charts without series: use { [xAxis]: label, value }.
 */
function useTransformedData(chartData: ChartPanelData) {
  return useMemo(() => {
    const { data, chartType, xAxis } = chartData
    const xKey = xAxis || 'label'

    if (chartType === 'pie') {
      // Pie uses raw data with label/value
      return {
        records: data.map((d) => ({ name: d.label, value: d.value })),
        seriesKeys: ['value'],
      }
    }

    // Check if data uses series grouping
    const seriesNames = new Set<string>()
    for (const d of data) {
      if (d.series) seriesNames.add(d.series)
    }

    if (seriesNames.size > 0) {
      // Pivot: group by label, each series becomes a column
      const grouped = new Map<string, Record<string, unknown>>()
      for (const d of data) {
        const key = d.label
        if (!grouped.has(key)) {
          grouped.set(key, { [xKey]: key })
        }
        const row = grouped.get(key)!
        const seriesName = d.series || 'value'
        row[seriesName] = d.value
      }
      return {
        records: Array.from(grouped.values()),
        seriesKeys: Array.from(seriesNames),
      }
    }

    // No series: single value column
    return {
      records: data.map((d) => ({ [xKey]: d.label, value: d.value })),
      seriesKeys: ['value'],
    }
  }, [chartData])
}

function CartesianChart({
  chartType,
  records,
  seriesKeys,
  xKey,
  colors,
  showLegend,
}: {
  chartType: 'line' | 'bar' | 'area'
  records: Record<string, unknown>[]
  seriesKeys: string[]
  xKey: string
  colors: string[]
  showLegend: boolean
}) {
  const commonChildren = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" strokeOpacity={0.5} />
      <XAxis
        dataKey={xKey}
        tick={{ fill: 'var(--color-muted-foreground)', fontSize: 11, fontFamily: 'var(--font-sans)' } as Record<string, unknown>}
        stroke="var(--color-border)"
        tickSize={4}
      />
      <YAxis
        tick={{ fill: 'var(--color-muted-foreground)', fontSize: 11, fontFamily: 'var(--font-sans)' } as Record<string, unknown>}
        stroke="var(--color-border)"
        tickSize={4}
        width={36}
      />
      <Tooltip contentStyle={TOOLTIP_STYLE} />
      {showLegend && <Legend wrapperStyle={{ fontSize: 11, lineHeight: '16px' }} />}
    </>
  )

  if (chartType === 'line') {
    return (
      <LineChart data={records}>
        {commonChildren}
        {seriesKeys.map((key, i) => (
          <Line
            key={key}
            type="monotone"
            dataKey={key}
            stroke={colors[i % colors.length]}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        ))}
      </LineChart>
    )
  }

  if (chartType === 'bar') {
    return (
      <BarChart data={records}>
        {commonChildren}
        {seriesKeys.map((key, i) => (
          <Bar
            key={key}
            dataKey={key}
            fill={colors[i % colors.length]}
            radius={[2, 2, 0, 0]}
          />
        ))}
      </BarChart>
    )
  }

  // area
  return (
    <AreaChart data={records}>
      {commonChildren}
      {seriesKeys.map((key, i) => (
        <Area
          key={key}
          type="monotone"
          dataKey={key}
          stroke={colors[i % colors.length]}
          fill={colors[i % colors.length]}
          fillOpacity={0.3}
        />
      ))}
    </AreaChart>
  )
}

function PieChartView({
  records,
  colors,
  showLegend,
}: {
  records: Record<string, unknown>[]
  colors: string[]
  showLegend: boolean
}) {
  return (
    <PieChart>
      <Pie
        data={records}
        dataKey="value"
        nameKey="name"
        cx="50%"
        cy="50%"
        outerRadius="75%"
        label={({ name, percent }: { name?: string; percent?: number }) =>
          `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`
        }
        labelLine={{ stroke: 'var(--color-muted-foreground)' }}
      >
        {records.map((_, i) => (
          <Cell key={i} fill={colors[i % colors.length]} />
        ))}
      </Pie>
      <Tooltip contentStyle={TOOLTIP_STYLE} />
      {showLegend && <Legend wrapperStyle={{ fontSize: 11, lineHeight: '16px' }} />}
    </PieChart>
  )
}

export function ChartPanel({ data, panelId }: PanelProps) {
  const { t } = useTranslation('panels')
  const themeChartColors = useChartColors()
  const chartData = useMemo(() => {
    if (isChartPanelData(data)) return data
    return null
  }, [data])

  if (!chartData || chartData.data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-4 text-sm text-muted-foreground">
        {!chartData
          ? `${t('cannot_render', { type: t('chart') })}: ${t('invalid_data')} (panelId: ${panelId})`
          : t('no_data')}
      </div>
    )
  }

  const colors = chartData.colors ?? themeChartColors
  const showLegend = chartData.legend !== false
  const xKey = chartData.xAxis || 'label'
  const { records, seriesKeys } = useTransformedData(chartData)

  return (
    <div className="w-full h-full flex items-center justify-center min-h-0 px-1 pb-1">
      <ResponsiveContainer width="100%" height="100%">
        {chartData.chartType === 'pie' ? (
          <PieChartView
            records={records}
            colors={colors}
            showLegend={showLegend}
          />
        ) : (
          <CartesianChart
            chartType={chartData.chartType}
            records={records}
            seriesKeys={seriesKeys}
            xKey={xKey}
            colors={colors}
            showLegend={showLegend}
          />
        )}
      </ResponsiveContainer>
    </div>
  )
}
