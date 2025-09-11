import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-semibold ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none active:scale-95",
  {
    variants: {
      variant: {
        default: "bg-gradient-to-r from-primary to-primary/90 text-black dark:text-white shadow-soft hover:shadow-medium hover:from-primary/90 hover:to-primary/80 hover:-translate-y-0.5 disabled:opacity-70",
        destructive:
          "bg-gradient-to-r from-destructive to-destructive/90 text-black dark:text-white shadow-soft hover:shadow-medium hover:from-destructive/90 hover:to-destructive/80 hover:-translate-y-0.5 disabled:opacity-70",
        outline:
          "border-2 border-border bg-background/50 backdrop-blur-sm text-black dark:text-white shadow-soft hover:bg-primary/5 hover:border-primary/50 hover:shadow-medium hover:-translate-y-0.5 disabled:bg-muted/60 disabled:text-muted-foreground disabled:border-border disabled:opacity-100",
        secondary:
          "bg-gradient-to-r from-secondary to-secondary/90 text-black dark:text-white shadow-soft hover:shadow-medium hover:from-secondary/90 hover:to-secondary/80 hover:-translate-y-0.5 disabled:opacity-70",
        ghost: "text-black dark:text-white hover:bg-primary/10 hover:text-primary transition-colors disabled:bg-transparent disabled:text-muted-foreground disabled:opacity-70",
        link: "text-primary underline-offset-4 hover:underline hover:text-primary/80 disabled:text-muted-foreground disabled:no-underline disabled:opacity-70",
        success: "bg-gradient-to-r from-green-500 to-green-600 text-success-foreground shadow-soft hover:shadow-medium hover:from-green-600 hover:to-green-700 hover:-translate-y-0.5 disabled:opacity-70",
        warning: "bg-gradient-to-r from-amber-500 to-amber-600 text-warning-foreground shadow-soft hover:shadow-medium hover:from-amber-600 hover:to-amber-700 hover:-translate-y-0.5 disabled:opacity-70",
        info: "bg-gradient-to-r from-blue-500 to-blue-600 text-info-foreground shadow-soft hover:shadow-medium hover:from-blue-600 hover:to-blue-700 hover:-translate-y-0.5 disabled:opacity-70",
        premium: "bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 text-white shadow-large hover:shadow-glow-lg animate-pulse-glow disabled:opacity-70",
      },
      size: {
        default: "h-11 px-6 py-2.5",
        sm: "h-9 rounded-lg px-4 text-xs",
        lg: "h-13 rounded-xl px-10 text-base",
        xl: "h-16 rounded-xl px-12 text-lg",
        icon: "h-11 w-11",
        "icon-sm": "h-9 w-9",
        "icon-lg": "h-13 w-13",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
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
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
