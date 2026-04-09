import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-bold transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 font-heebo gap-1.5',
  {
    variants: {
      variant: {
        default: 'bg-[var(--orange)] text-white hover:bg-[var(--orange)]/90',
        secondary: 'bg-[var(--dark3)] text-[var(--text)] border border-[var(--orange-border)] hover:border-[var(--orange)] hover:text-[var(--orange)]',
        destructive: 'bg-[var(--red)]/15 text-[var(--red)] border border-[var(--red)]/30 hover:bg-[var(--red)]/25',
        ghost: 'text-[var(--orange)] underline hover:text-[var(--orange)]/80 bg-transparent',
        link: 'text-[var(--orange)] underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-5 py-2',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-11 px-8',
        full: 'h-10 px-5 py-2 w-full',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
