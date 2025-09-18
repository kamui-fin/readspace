import * as React from 'react'
import { cn } from '@readspace/shared'
import { badgeVariants, type BadgeVariants } from './badge-variants'

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    BadgeVariants {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}
