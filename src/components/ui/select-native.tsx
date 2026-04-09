import * as React from 'react'
import { cn } from '@/lib/utils'

export interface SelectNativeProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

const SelectNative = React.forwardRef<HTMLSelectElement, SelectNativeProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <select
        className={cn(
          'w-full rounded-lg border-[1.5px] border-[var(--orange-border)] bg-[var(--dark3)] px-3 py-2 text-sm text-[var(--text)] font-heebo transition-colors focus:border-[var(--orange)] focus:outline-none [&>option]:bg-[var(--dark3)]',
          className
        )}
        ref={ref}
        {...props}
      >
        {children}
      </select>
    )
  }
)
SelectNative.displayName = 'SelectNative'

export { SelectNative }
