import { useState, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Calendar, dateFnsLocalizer } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay } from 'date-fns'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import type { PanelProps } from './PanelRegistry'
import type { TimelinePanelData } from '@/types/panel-data'

// ── date-fns localizer ──────────────────────────────────────────────

const locales = { 'en-US': undefined }

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
})

// ── Types ───────────────────────────────────────────────────────────

type ViewMode = 'day' | 'week' | 'month'

interface CalendarEvent {
  id: string
  title: string
  start: Date
  end: Date
  color?: string
  description?: string
}

interface TimelineEvent {
  id: string
  date: string
  endDate?: string
  title: string
  description?: string
  color?: string
  group?: string
}

// ── Helpers ─────────────────────────────────────────────────────────

function isTimelinePanelData(data: unknown): data is TimelinePanelData {
  if (data == null || typeof data !== 'object') return false
  const obj = data as Record<string, unknown>
  return (
    Array.isArray(obj['events']) &&
    typeof obj['viewMode'] === 'string'
  )
}

function toCalendarEvents(events: TimelineEvent[]): CalendarEvent[] {
  return events.map((evt) => {
    const start = new Date(evt.date)
    const end = evt.endDate ? new Date(evt.endDate) : new Date(evt.date)
    return {
      id: evt.id,
      title: evt.title,
      start,
      end,
      color: evt.color,
      description: evt.description,
    }
  })
}

function formatTime(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return format(d, 'HH:mm')
  } catch {
    return ''
  }
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return format(d, 'MM-dd HH:mm')
  } catch {
    return dateStr
  }
}

// ── View Tabs ───────────────────────────────────────────────────────

const VIEW_LABEL_KEYS: Record<ViewMode, string> = {
  day: 'view_day',
  week: 'view_week',
  month: 'view_month',
}

function ViewSwitcher({
  current,
  onChange,
}: {
  current: ViewMode
  onChange: (v: ViewMode) => void
}) {
  const { t } = useTranslation('panels')
  return (
    <div className="flex items-center gap-1 px-2.5 py-1 shrink-0">
      {(['day', 'week', 'month'] as ViewMode[]).map((v) => (
        <button
          key={v}
          className={`px-2.5 py-0.5 text-xs rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none ${
            current === v
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/50'
          }`}
          onClick={() => onChange(v)}
        >
          {t(VIEW_LABEL_KEYS[v])}
        </button>
      ))}
    </div>
  )
}

// ── Day View (custom vertical timeline) ─────────────────────────────

function DayTimelineView({ events }: { events: TimelineEvent[] }) {
  const { t } = useTranslation('panels')
  const sorted = useMemo(
    () =>
      [...events].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      ),
    [events],
  )

  if (sorted.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        {t('no_events')}
      </div>
    )
  }

  return (
    <div className="flex flex-col overflow-y-auto flex-1">
      {sorted.map((evt, idx) => (
        <div key={evt.id} className="flex gap-2.5 shrink-0">
          {/* Time label */}
          <div className="w-12 shrink-0 text-[11px] text-muted-foreground text-right pt-1 font-mono tabular-nums">
            {formatTime(evt.date)}
          </div>

          {/* Timeline line + dot */}
          <div className="flex flex-col items-center shrink-0">
            <div
              className="w-2 h-2 rounded-full shrink-0 mt-1.5"
              style={{ backgroundColor: evt.color || 'var(--color-muted-foreground)' }}
            />
            {idx < sorted.length - 1 && (
              <div className="w-px flex-1 bg-border/50" />
            )}
          </div>

          {/* Event card */}
          <div
            className="flex-1 rounded-md px-2.5 py-1.5 mb-1.5 border border-border/30 hover:border-border/50 transition-colors"
            style={
              evt.color
                ? { backgroundColor: `${evt.color}15`, borderColor: `${evt.color}40` }
                : undefined
            }
          >
            <div className="text-xs font-medium text-foreground">
              {evt.title}
            </div>
            <div className="text-[11px] text-muted-foreground tabular-nums">
              {formatDate(evt.date)}
              {evt.endDate && ` — ${formatDate(evt.endDate)}`}
            </div>
            {evt.description && (
              <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                {evt.description}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Calendar Views (week / month) ───────────────────────────────────

function CalendarView({
  events,
  viewMode,
  focusDate,
}: {
  events: TimelineEvent[]
  viewMode: 'week' | 'month'
  focusDate: Date
}) {
  const { t } = useTranslation('panels')
  const calEvents = useMemo(() => toCalendarEvents(events), [events])

  const eventPropGetter = useCallback((event: CalendarEvent) => {
    if (!event.color) return {}
    return {
      style: {
        backgroundColor: event.color,
        borderColor: event.color,
        color: 'var(--panel-calendar-event-text)',
      },
    }
  }, [])

  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        {t('no_events')}
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-hidden p-2 rbc-theme">
      <Calendar
        localizer={localizer}
        events={calEvents}
        view={viewMode}
        defaultDate={focusDate}
        date={focusDate}
        onNavigate={() => {}}
        views={['week', 'month']}
        toolbar={false}
        eventPropGetter={eventPropGetter}
        style={{ height: '100%' }}
      />
    </div>
  )
}

// ── TimelinePanel (main) ────────────────────────────────────────────

export function TimelinePanel({ panelId, data }: PanelProps) {
  const { t } = useTranslation('panels')
  const panelData = useMemo<TimelinePanelData | null>(() => {
    if (isTimelinePanelData(data)) return data
    return null
  }, [data])

  const [activeView, setActiveView] = useState<ViewMode>(
    panelData?.viewMode ?? 'day',
  )

  const focusDate = useMemo(() => {
    if (panelData?.focusDate) {
      const d = new Date(panelData.focusDate)
      if (!isNaN(d.getTime())) return d
    }
    return new Date()
  }, [panelData?.focusDate])

  if (!panelData) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        {t('cannot_render', { type: t('timeline') })}: {t('invalid_data')} (panelId: {panelId})
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <ViewSwitcher current={activeView} onChange={setActiveView} />
      {activeView === 'day' ? (
        <DayTimelineView events={panelData.events} />
      ) : (
        <CalendarView
          events={panelData.events}
          viewMode={activeView}
          focusDate={focusDate}
        />
      )}
    </div>
  )
}
