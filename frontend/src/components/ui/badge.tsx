import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 shadow-sm",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-gradient-to-r from-primary to-primary/90 text-white shadow-soft hover:shadow-medium hover:scale-105",
        secondary:
          "border-transparent bg-gradient-to-r from-secondary to-secondary/90 text-white shadow-soft hover:shadow-medium hover:scale-105",
        destructive:
          "border-transparent bg-gradient-to-r from-destructive to-destructive/90 text-white shadow-soft hover:shadow-medium hover:scale-105",
        outline: "border-border/60 bg-background/50 text-foreground backdrop-blur-sm hover:bg-primary/5 hover:border-primary/50",
        success:
          "border-transparent bg-gradient-to-r from-green-500 to-green-600 text-white shadow-soft hover:shadow-medium hover:scale-105",
        warning:
          "border-transparent bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-soft hover:shadow-medium hover:scale-105",
        info:
          "border-transparent bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-soft hover:shadow-medium hover:scale-105",
        muted:
          "border-transparent bg-muted text-muted-foreground hover:bg-muted/80",
        premium:
          "border-transparent bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 text-white shadow-medium animate-pulse-glow",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
