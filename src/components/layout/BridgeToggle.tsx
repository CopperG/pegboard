import { useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { invoke } from '@tauri-apps/api/core'
import { useBridgeStore } from '@/stores/bridge-store'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

/**
 * Clickable status light for the app-managed claude-bridge child process.
 * Mirrors ConnectionDot's look; click toggles start/stop via Tauri commands.
 * Green = running, yellow = starting, red = error, gray = stopped.
 */
export function BridgeToggle() {
  const { t } = useTranslation('sidebar')
  const status = useBridgeStore((s) => s.status)
  const setStatus = useBridgeStore((s) => s.setStatus)

  // Sync with the real process state on mount (catches a child that outlived a
  // frontend reload; on a fresh app launch it's always stopped).
  useEffect(() => {
    invoke<string>('bridge_status')
      .then((s) => setStatus(s === 'running' ? 'running' : 'stopped'))
      .catch(() => {})
  }, [setStatus])

  const toggle = useCallback(async () => {
    const cur = useBridgeStore.getState().status
    if (cur === 'starting') return // ignore clicks mid-start
    if (cur === 'running') {
      try {
        await invoke('stop_bridge')
        setStatus('stopped')
      } catch (e) {
        setStatus('error')
        toast.error(t('bridge_stop_failed'), { description: String(e) })
      }
      return
    }
    setStatus('starting')
    try {
      await invoke('start_bridge')
      setStatus('running')
      toast.success(t('bridge_started'))
    } catch (e) {
      setStatus('error')
      toast.error(t('bridge_start_failed'), { description: String(e) })
    }
  }, [setStatus, t])

  const colorClass =
    status === 'running'
      ? 'bg-panel-status-success'
      : status === 'starting'
        ? 'bg-panel-status-warning'
        : status === 'error'
          ? 'bg-panel-status-error'
          : 'bg-muted-foreground/40'

  const label =
    status === 'running'
      ? t('bridge_running')
      : status === 'starting'
        ? t('bridge_starting')
        : status === 'error'
          ? t('bridge_error')
          : t('bridge_stopped')

  return (
    <button
      type="button"
      onClick={toggle}
      className="relative group flex items-center justify-center rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      aria-label={label}
      aria-pressed={status === 'running'}
    >
      <span className={cn('size-2.5 rounded-full shrink-0 transition-colors', colorClass)} title={label} />
      <span className="sr-only">{label}</span>
      <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2 py-1 bg-popover text-popover-foreground text-xs font-medium rounded-md shadow-md border border-border/50 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50">
        {label}
      </div>
    </button>
  )
}
