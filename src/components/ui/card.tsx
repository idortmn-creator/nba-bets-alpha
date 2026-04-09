import * as React from 'react'
import { cn } from '@/lib/utils'

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('rounded-2xl border border-[var(--orange-border)] bg-[var(--card-bg)] p-5 mb-4', className)}
      {...props}
    />
  )
)
Card.displayName = 'Card'

const CardTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('font-oswald text-lg text-[var(--orange)] mb-3 flex items-center gap-2', className)}
      {...props}
    />
  )
)
CardTitle.displayName = 'CardTitle'

export { Card, CardTitle }
