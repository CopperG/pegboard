import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './button'
import type { ReactNode } from 'react'

interface ErrorStateProps {
  title: string
  description?: string
  icon?: ReactNode
  retryAction?: () => void
  retryLabel?: string
  className?: string
}

function ErrorState({
  title,
  description,
  icon,
  retryAction,
  retryLabel = 'Retry',
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 p-6 text-center',
        className
      )}
    >
      <div className="flex items-center justify-center size-10 rounded-full bg-destructive/10 text-destructive">
        {icon || <AlertCircle className="size-5" />}
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground text-balance">{title}</p>
        {description && (
          <p className="text-xs text-muted-foreground text-pretty">{description}</p>
        )}
      </div>
      {retryAction && (
        <Button variant="outline" size="sm" onClick={retryAction}>
          {retryLabel}
        </Button>
      )}
    </div>
  )
}

export { ErrorState }
export type { ErrorStateProps }
