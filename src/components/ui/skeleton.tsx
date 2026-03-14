import { cn } from '@/lib/utils'

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('bg-muted motion-safe:animate-pulse rounded', className)}
      {...props}
    />
  )
}

type PanelSkeletonType = 'text' | 'table' | 'chart' | 'code' | 'image'

function PanelSkeleton({ type }: { type: PanelSkeletonType }) {
  switch (type) {
    case 'text':
      return (
        <div className="space-y-3 p-1">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      )
    case 'table':
      return (
        <div className="space-y-2 p-1">
          <Skeleton className="h-8 w-full rounded-md" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </div>
      )
    case 'chart':
      return (
        <div className="flex items-end gap-2 p-1 h-full min-h-[120px]">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton
              key={i}
              className="flex-1 rounded-t"
              style={{ height: `${30 + Math.random() * 60}%` }}
            />
          ))}
        </div>
      )
    case 'code':
      return (
        <div className="space-y-2 p-1 font-mono">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-4 w-6 shrink-0" />
              <Skeleton className="h-4" style={{ width: `${40 + Math.random() * 50}%` }} />
            </div>
          ))}
        </div>
      )
    case 'image':
      return (
        <div className="flex items-center justify-center p-4 h-full">
          <Skeleton className="w-full aspect-video rounded-lg" />
        </div>
      )
    default:
      return (
        <div className="space-y-3 p-1">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      )
  }
}

export { Skeleton, PanelSkeleton }
