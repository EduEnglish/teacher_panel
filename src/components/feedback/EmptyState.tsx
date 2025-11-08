import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/utils/cn'

type EmptyStateProps = {
  title: string
  description?: string
  icon?: ReactNode
  actionLabel?: string
  onAction?: () => void
  className?: string
}

export function EmptyState({ title, description, icon, actionLabel, onAction, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex h-56 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-white text-center',
        className,
      )}
    >
      {icon && <div className="text-primary">{icon}</div>}
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      {actionLabel && onAction && (
        <Button variant="outline" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  )
}


