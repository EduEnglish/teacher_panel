import type { ReactNode } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/utils/cn'

type StatsCardProps = {
  title: string
  value: string
  description?: string
  icon?: ReactNode
  trend?: {
    value: string
    isPositive?: boolean
  }
  className?: string
}

export function StatsCard({ title, value, description, icon, trend, className }: StatsCardProps) {
  return (
    <Card className={cn('border-none bg-gradient-to-br from-white to-slate-50 shadow-sm', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6">
        <div>
          <CardDescription>{title}</CardDescription>
          <CardTitle className="mt-1 text-3xl font-semibold">{value}</CardTitle>
        </div>
        {icon && <div className="text-primary">{icon}</div>}
      </CardHeader>
      {(description || trend) && (
        <CardContent className="flex items-center justify-between text-sm text-muted-foreground">
          {description && <span>{description}</span>}
          {trend && (
            <span className={cn('font-medium', trend.isPositive ? 'text-emerald-500' : 'text-rose-500')}>
              {trend.value}
            </span>
          )}
        </CardContent>
      )}
    </Card>
  )
}


