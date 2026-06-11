import { useEffect, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { zhCN, enUS } from 'date-fns/locale'
import { useTranslation } from 'react-i18next'

const REFRESH_MS = 30_000

/** ISO time -> { relative: "3 分钟前", absolute: locale string }, refreshes every 30s */
export function useRelativeTime(isoTime: string | undefined): {
  relative: string
  absolute: string
} {
  const { i18n } = useTranslation()
  const [, setTick] = useState(0)

  useEffect(() => {
    // No timer when there is nothing to display; starts when isoTime first appears
    if (!isoTime) return
    const timer = setInterval(() => setTick((n) => n + 1), REFRESH_MS)
    return () => clearInterval(timer)
  }, [isoTime])

  if (!isoTime) return { relative: '', absolute: '' }
  const date = new Date(isoTime)
  if (isNaN(date.getTime())) return { relative: '', absolute: '' }

  const locale = i18n.language?.startsWith('zh') ? zhCN : enUS
  return {
    relative: formatDistanceToNow(date, { addSuffix: true, locale }),
    absolute: date.toLocaleString(),
  }
}
