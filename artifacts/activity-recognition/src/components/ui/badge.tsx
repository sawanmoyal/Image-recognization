import * as React from "react"
import { cn } from "@/lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "destructive" | "outline" | "secondary"
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-sm border px-2.5 py-0.5 text-xs font-mono font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        {
          "border-primary bg-primary/10 text-primary": variant === "default",
          "border-destructive bg-destructive/10 text-destructive shadow-[0_0_10px_rgba(255,0,0,0.2)]": variant === "destructive",
          "border-border text-foreground": variant === "outline",
          "border-transparent bg-secondary text-secondary-foreground": variant === "secondary",
        },
        className
      )}
      {...props}
    />
  )
}

export { Badge }
