import { ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface StatCardProps {
  title: string
  value: string | number
  description?: string
  icon?: ReactNode
  trend?: {
    value: number | string
    isPositive: boolean
    label?: string
  }
  className?: string
  iconBackground?: string
}

export function StatCard({
  title,
  value,
  description,
  icon,
  trend,
  className,
  iconBackground = 'bg-indigo-100'
}: StatCardProps) {
  return (
    <Card className={cn('border-0 shadow-lg', className)}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </p>
            {(description || trend) && (
              <div className="flex items-center mt-2 text-sm">
                {trend && (
                  <>
                    <span className={cn(
                      'font-medium',
                      trend.isPositive ? 'text-emerald-600' : 'text-red-600'
                    )}>
                      {trend.isPositive ? '+' : ''}{trend.value}
                    </span>
                    {trend.label && (
                      <span className="text-gray-500 dark:text-gray-400 ml-1">
                        {trend.label}
                      </span>
                    )}
                  </>
                )}
                {description && !trend && (
                  <span className="text-gray-500 dark:text-gray-400">{description}</span>
                )}
              </div>
            )}
          </div>
          {icon && (
            <div className={cn('p-3 rounded-lg', iconBackground)}>
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
