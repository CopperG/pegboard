import { useTranslation } from 'react-i18next'
import { AlertCircle } from 'lucide-react'
import type { PanelProps } from './PanelRegistry'

export function FallbackPanel({ data }: PanelProps) {
  const { t } = useTranslation('panels')
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="flex items-center justify-center size-10 rounded-full bg-destructive/10 text-destructive">
        <AlertCircle className="size-5" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground text-balance">
          {t('unknown_panel_type')}
        </p>
      </div>
      <details className="text-xs w-full">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
          {t('view_raw_data')}
        </summary>
        <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto max-h-60 text-left">
          {JSON.stringify(data, null, 2)}
        </pre>
      </details>
    </div>
  )
}
