import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'w-full rounded-lg border-[1.5px] border-[var(--orange-border)] bg-[var(--dark3)] px-3 py-2 text-sm text-[var(--text)] font-heebo transition-colors placeholder:text-[var(--text2)] focus:border-[var(--orange)] focus:outline-none',
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = 'Input'

export { Input }
