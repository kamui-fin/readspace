"use client"

import {
    AlertTriangleIcon,
    CheckCircleIcon,
    InfoIcon,
    Loader2Icon,
    XCircleIcon,
} from "lucide-react"
import React from "react"
import { Toaster as Sonner, toast as sonnerToast } from "sonner"

// Define toast types
type ToastType =
    | "success"
    | "error"
    | "info"
    | "warning"
    | "loading"
    | "default"

// 1. Update Props to include optional type
interface CustomToastProps {
    id: string | number
    title: string
    description?: string // Make description optional
    type?: ToastType
    button?: {
        label: string
        onClick: () => void
    }
}

// Mapping for icons and colors based on type
const typeConfig: Record<
    ToastType,
    { icon: React.ElementType; colorClass: string }
> = {
    success: {
        icon: CheckCircleIcon,
        colorClass: "text-[hsl(var(--primary))]",
    }, // Use primary for success
    error: { icon: XCircleIcon, colorClass: "text-[hsl(var(--destructive))]" },
    warning: { icon: AlertTriangleIcon, colorClass: "text-orange-500" }, // Using orange as an example
    info: { icon: InfoIcon, colorClass: "text-blue-500" }, // Using blue as an example
    loading: { icon: Loader2Icon, colorClass: "text-muted-foreground" }, // Use muted for loading
    default: { icon: InfoIcon, colorClass: "text-foreground" }, // Default uses foreground
}

// 2. Update the Custom Toast Component to render icon and apply color
const CustomToast: React.FC<CustomToastProps> = (props) => {
    const { title, description, button, id, type = "default" } = props
    const config = typeConfig[type] || typeConfig.default
    const IconComponent = config.icon

    return (
        <div className="font-sans flex w-full max-w-sm items-start rounded-lg bg-background p-4 shadow-lg ring-1 ring-black/5 dark:ring-white/10">
            {/* Icon Section */}
            <div className={`mr-3 mt-0.5 shrink-0 ${config.colorClass}`}>
                <IconComponent
                    className={`h-5 w-5 ${type === "loading" ? "animate-spin" : ""}`}
                />
            </div>

            {/* Text Content */}
            <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{title}</p>
                {description && (
                    <p className="mt-1 text-sm text-muted-foreground">
                        {description}
                    </p>
                )}
            </div>

            {/* Button Section */}
            {button && (
                <div className="ml-4 shrink-0 self-center">
                    <button
                        className="rounded-md bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary hover:bg-primary/20 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-background"
                        onClick={(e) => {
                            e.preventDefault() // Prevent potential form submission
                            button.onClick()
                            sonnerToast.dismiss(id)
                        }}
                    >
                        {button.label}
                    </button>
                </div>
            )}
        </div>
    )
}

// 3. Update the abstraction function props
type ShowCustomToastProps = Omit<CustomToastProps, "id"> & {
    duration?: number
}

type ToastAction = {
    label: string
    onClick: () => void
}

type ToastOptions = {
    action?: ToastAction
    duration?: number
}

interface ToastFn {
    (title: string, options?: ToastOptions): string | number
    (
        title: string,
        description: string,
        options?: ToastOptions
    ): string | number
}

function showCustomToast(props: ShowCustomToastProps): string | number {
    const toastId = sonnerToast.custom(
        (id) => (
            <CustomToast
                id={id}
                title={props.title}
                description={props.description}
                type={props.type}
                button={props.button}
            />
        ),
        {
            duration: props.duration,
        }
    )
    return toastId
}

function resolveToastArgs(
    title: string,
    descriptionOrOptions?: string | ToastOptions,
    maybeOptions?: ToastOptions
): { title: string; description?: string; options?: ToastOptions } {
    if (typeof descriptionOrOptions === "string") {
        return {
            title,
            description: descriptionOrOptions,
            options: maybeOptions,
        }
    }
    return { title, options: descriptionOrOptions }
}

const toast = Object.assign(
    ((
        title: string,
        descriptionOrOptions?: string | ToastOptions,
        maybeOptions?: ToastOptions
    ) => {
        const {
            title: t,
            description,
            options,
        } = resolveToastArgs(title, descriptionOrOptions, maybeOptions)
        return showCustomToast({
            title: t,
            description,
            type: "default",
            button: options?.action,
            duration: options?.duration,
        })
    }) as ToastFn,
    {
        custom: (props: ShowCustomToastProps) => showCustomToast(props),
        success: ((
            title: string,
            descriptionOrOptions?: string | ToastOptions,
            maybeOptions?: ToastOptions
        ) => {
            const {
                title: t,
                description,
                options,
            } = resolveToastArgs(title, descriptionOrOptions, maybeOptions)
            return showCustomToast({
                title: t,
                description,
                type: "success",
                button: options?.action,
                duration: options?.duration,
            })
        }) as ToastFn,
        error: ((
            title: string,
            descriptionOrOptions?: string | ToastOptions,
            maybeOptions?: ToastOptions
        ) => {
            const {
                title: t,
                description,
                options,
            } = resolveToastArgs(title, descriptionOrOptions, maybeOptions)
            return showCustomToast({
                title: t,
                description,
                type: "error",
                button: options?.action,
                duration: options?.duration,
            })
        }) as ToastFn,
        info: ((
            title: string,
            descriptionOrOptions?: string | ToastOptions,
            maybeOptions?: ToastOptions
        ) => {
            const {
                title: t,
                description,
                options,
            } = resolveToastArgs(title, descriptionOrOptions, maybeOptions)
            return showCustomToast({
                title: t,
                description,
                type: "info",
                button: options?.action,
                duration: options?.duration,
            })
        }) as ToastFn,
        warning: ((
            title: string,
            descriptionOrOptions?: string | ToastOptions,
            maybeOptions?: ToastOptions
        ) => {
            const {
                title: t,
                description,
                options,
            } = resolveToastArgs(title, descriptionOrOptions, maybeOptions)
            return showCustomToast({
                title: t,
                description,
                type: "warning",
                button: options?.action,
                duration: options?.duration,
            })
        }) as ToastFn,
        loading: ((
            title: string,
            descriptionOrOptions?: string | ToastOptions,
            maybeOptions?: ToastOptions
        ) => {
            const {
                title: t,
                description,
                options,
            } = resolveToastArgs(title, descriptionOrOptions, maybeOptions)
            return showCustomToast({
                title: t,
                description,
                type: "loading",
                button: options?.action,
                duration: options?.duration,
            })
        }) as ToastFn,
        message: ((
            title: string,
            descriptionOrOptions?: string | ToastOptions,
            maybeOptions?: ToastOptions
        ) => {
            const {
                title: t,
                description,
                options,
            } = resolveToastArgs(title, descriptionOrOptions, maybeOptions)
            return showCustomToast({
                title: t,
                description,
                type: "default",
                button: options?.action,
                duration: options?.duration,
            })
        }) as ToastFn,
        dismiss: (id?: string | number): void => {
            sonnerToast.dismiss(id)
        },
        promise<T>(
            promise: Promise<T>,
            messages: {
                loading:
                    | string
                    | { title: string; description?: string }
                    | (() => string | { title: string; description?: string })
                success:
                    | string
                    | { title: string; description?: string }
                    | (() => string | { title: string; description?: string })
                error:
                    | string
                    | { title: string; description?: string }
                    | (() => string | { title: string; description?: string })
            },
            options?: { duration?: number }
        ): any {
            function resolveState(state: any, id: string): React.ReactNode {
                if (typeof state === "function") {
                    const val = state()
                    if (typeof val === "string")
                        return (
                            <CustomToast id={id} title={val} type={id as any} />
                        )
                    return (
                        <CustomToast
                            id={id}
                            title={val.title}
                            description={val.description}
                            type={id as any}
                        />
                    )
                }
                if (typeof state === "string")
                    return (
                        <CustomToast id={id} title={state} type={id as any} />
                    )
                return (
                    <CustomToast
                        id={id}
                        title={state.title}
                        description={state.description}
                        type={id as any}
                    />
                )
            }
            const toastId = sonnerToast.promise(promise, {
                loading: resolveState(messages.loading, "loading"),
                success: resolveState(messages.success, "success"),
                error: resolveState(messages.error, "error"),
            } as any)
            if (options?.duration) {
                setTimeout(() => {
                    const id =
                        (toastId as any)?.id ??
                        (toastId as any)?.toastId ??
                        toastId
                    sonnerToast.dismiss(id)
                }, options.duration)
            }
            return toastId
        },
    }
)

const Toaster: React.FC<React.ComponentProps<typeof Sonner>> = (props) => {
    return (
        <Sonner
            position="top-center"
            className="toaster group"
            toastOptions={{
                style: {
                    maxWidth: "384px",
                    width: "100%",
                },
            }}
            {...props}
        />
    )
}

export { toast, Toaster }
