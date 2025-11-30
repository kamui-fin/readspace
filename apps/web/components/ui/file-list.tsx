"use client"

import { cn } from "@/lib/utils"
import * as React from "react"
import { Progress } from "./progress"

const FileList = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div ref={ref} className={cn("w-full space-y-2", className)} {...props} />
))
FileList.displayName = "FileList"

const FileListItem = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div ref={ref} className={cn("w-full", className)} {...props} />
))
FileListItem.displayName = "FileListItem"

const FileListHeader = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn("flex items-center gap-2", className)}
        {...props}
    />
))
FileListHeader.displayName = "FileListHeader"

const FileListIcon = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn(
            "flex h-8 w-8 items-center justify-center rounded-md bg-muted",
            className
        )}
        {...props}
    />
))
FileListIcon.displayName = "FileListIcon"

const FileListInfo = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex-1 min-w-0", className)} {...props} />
))
FileListInfo.displayName = "FileListInfo"

const FileListName = React.forwardRef<
    HTMLParagraphElement,
    React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
    <p
        ref={ref}
        className={cn("text-sm font-medium leading-none truncate", className)}
        {...props}
    />
))
FileListName.displayName = "FileListName"

const FileListDescription = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn(
            "flex items-center gap-1 text-xs text-muted-foreground mt-1",
            className
        )}
        {...props}
    />
))
FileListDescription.displayName = "FileListDescription"

const FileListSize = React.forwardRef<
    HTMLSpanElement,
    React.HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) => (
    <span ref={ref} className={cn("", className)} {...props} />
))
FileListSize.displayName = "FileListSize"

const FileListDescriptionSeparator = React.forwardRef<
    HTMLSpanElement,
    React.HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) => (
    <span
        ref={ref}
        className={cn("text-muted-foreground/50", className)}
        {...props}
    />
))
FileListDescriptionSeparator.displayName = "FileListDescriptionSeparator"

const FileListDescriptionText = React.forwardRef<
    HTMLSpanElement,
    React.HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) => (
    <span ref={ref} className={cn("", className)} {...props} />
))
FileListDescriptionText.displayName = "FileListDescriptionText"

const FileListActions = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn("flex items-center gap-1", className)}
        {...props}
    />
))
FileListActions.displayName = "FileListActions"

const FileListAction = React.forwardRef<
    HTMLButtonElement,
    React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => (
    <button
        ref={ref}
        className={cn(
            "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 w-8",
            className
        )}
        {...props}
    />
))
FileListAction.displayName = "FileListAction"

const FileListContent = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div ref={ref} className={cn("mt-2", className)} {...props} />
))
FileListContent.displayName = "FileListContent"

const FileListProgress = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & { value?: number }
>(({ className, value, ...props }, ref) => (
    <Progress
        ref={ref}
        value={value}
        className={cn("h-1", className)}
        {...props}
    />
))
FileListProgress.displayName = "FileListProgress"

export {
    FileList,
    FileListAction,
    FileListActions,
    FileListContent,
    FileListDescription,
    FileListDescriptionSeparator,
    FileListDescriptionText,
    FileListHeader,
    FileListIcon,
    FileListInfo,
    FileListItem,
    FileListName,
    FileListProgress,
    FileListSize,
}
