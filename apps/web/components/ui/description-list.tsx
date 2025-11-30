import React from "react"

import { cn } from "@/lib/utils"

export const DescriptionList = React.forwardRef<
    React.ElementRef<"dl">,
    React.ComponentPropsWithoutRef<"dl">
>(({ className, ...props }, ref) => (
    <dl ref={ref} className={cn("grid gap-6", className)} {...props} />
))
DescriptionList.displayName = "DescriptionList"

export const DescriptionTerm = React.forwardRef<
    HTMLElement,
    React.HTMLAttributes<HTMLElement>
>(({ className, ...props }, ref) => (
    <dt
        ref={ref}
        className={cn("font-medium leading-none tracking-tight", className)}
        {...props}
    />
))
DescriptionTerm.displayName = "DescriptionTerm"

export const DescriptionDetail = React.forwardRef<
    HTMLElement,
    React.HTMLAttributes<HTMLElement>
>(({ className, ...props }, ref) => (
    <dd
        ref={ref}
        className={cn("text-sm text-muted-foreground", className)}
        {...props}
    />
))
DescriptionDetail.displayName = "DescriptionDetail"

export const DescriptionGroup = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div ref={ref} className={cn("grid gap-1.5", className)} {...props} />
))
DescriptionGroup.displayName = "DescriptionGroup"
