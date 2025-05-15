"use client"

import type { DndContextProps, UniqueIdentifier } from "@dnd-kit/core"
import {
    closestCenter,
    DndContext,
    DragOverlay,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from "@dnd-kit/core"
import {
    horizontalListSortingStrategy,
    NewIndexGetter,
    SortableContext,
    SortableContextProps,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS, Transform } from "@dnd-kit/utilities"
import { composeRefs } from "@radix-ui/react-compose-refs"
import * as PortalPrimitive from "@radix-ui/react-portal"
import { Primitive } from "@radix-ui/react-primitive"
import * as React from "react"

import { cn } from "@/lib/utils"

const SortableImplContext = React.createContext<
    Pick<SortableProps, "getNewIndex"> &
    Required<Pick<SortableProps, "getTransformStyle">> & {
        activeId: UniqueIdentifier | null
    }
>({
    activeId: null,
    getTransformStyle: CSS.Transform.toString,
})

function useSortableImplContext() {
    const context = React.useContext(SortableImplContext)

    if (!context) {
        throw new Error(
            "useSortableImplContext must be used within a <Sortable />"
        )
    }

    return context
}

export interface SortableProps extends DndContextProps {
    onReorder?: (oldIndex: number, newIndex: number) => void
    getNewIndex?: NewIndexGetter
    getTransformStyle?: (
        transform: Transform | null
    ) => React.CSSProperties["transform"]
}

export const Sortable = ({
    onDragStart,
    onDragEnd,
    onDragCancel,
    getNewIndex,
    collisionDetection = closestCenter,
    getTransformStyle = CSS.Transform.toString,
    ...props
}: SortableProps) => {
    const [activeId, setActiveId] = React.useState<UniqueIdentifier | null>(
        null
    )

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    )

    return (
        <SortableImplContext.Provider
            value={{
                activeId,
                getTransformStyle,
                getNewIndex,
            }}
        >
            <DndContext
                onDragStart={(event) => {
                    onDragStart?.(event);
                    setActiveId(event.active.id);
                }}
                onDragEnd={(event) => {
                    onDragEnd?.(event);
                    setActiveId(null);
                }}
                onDragCancel={(event) => {
                    onDragCancel?.(event);
                    setActiveId(null);
                }}
                collisionDetection={collisionDetection}
                sensors={sensors}
                {...props}
            />
        </SortableImplContext.Provider>
    )
}

export interface SortableListProps
    extends Omit<SortableContextProps, "children">,
    React.ComponentPropsWithoutRef<typeof Primitive.ul> {
    orientation?: "vertical" | "horizontal"
}

export const SortableList = React.forwardRef<
    React.ElementRef<typeof Primitive.ul>,
    SortableListProps
>(
    (
        {
            orientation = "vertical",
            strategy = orientation === "vertical"
                ? verticalListSortingStrategy
                : horizontalListSortingStrategy,
            items,
            disabled,
            id,
            ...props
        },
        ref
    ) => (
        <SortableContext
            strategy={strategy}
            items={items}
            disabled={disabled}
            id={id}
        >
            <Primitive.ul ref={ref} data-orientation={orientation} {...props} />
        </SortableContext>
    )
)
SortableList.displayName = "SortableList"

export type SortableGridProps = Omit<SortableContextProps, "children"> &
    React.ComponentPropsWithoutRef<typeof Primitive.div>

export const SortableGrid = React.forwardRef<
    React.ElementRef<typeof Primitive.div>,
    SortableGridProps
>(({ strategy, items, disabled, id, ...props }, ref) => (
    <SortableContext
        strategy={strategy}
        items={items}
        disabled={disabled}
        id={id}
    >
        <Primitive.div ref={ref} {...props} />
    </SortableContext>
))
SortableGrid.displayName = "SortableGrid"

const SortableItemContext = React.createContext<
    Pick<SortableItemProps, "id" | "disabled">
>({
    id: "",
    disabled: false,
})

function useSortableItemContext() {
    const context = React.useContext(SortableItemContext)

    if (!context) {
        throw new Error(
            "useSortableItemContext must be used within a <SortableItem />"
        )
    }

    return context
}

export type SortableItemProps = Omit<
    React.ComponentPropsWithoutRef<typeof Primitive.div>,
    "id"
> &
    Pick<Parameters<typeof useSortable>[0], "id" | "disabled">

export const SortableItem = React.forwardRef<
    React.ElementRef<typeof Primitive.div>,
    SortableItemProps
>(({ id, disabled, style: styleProp, ...props }, ref) => {
    const { getTransformStyle, getNewIndex } = useSortableImplContext()

    const {
        attributes,
        setNodeRef,
        transform,
        transition,
        isDragging,
        isOver,
        isSorting,
    } = useSortable({
        id,
        disabled,
        getNewIndex,
    })

    const style = {
        transform: getTransformStyle(transform),
        transition,
        ...styleProp,
    }

    return (
        <SortableItemContext.Provider value={{ id, disabled }}>
            <Primitive.div
                ref={composeRefs(
                    setNodeRef as React.RefCallback<HTMLDivElement>,
                    ref
                )}
                style={style}
                data-dragging={isDragging ? true : undefined}
                data-over={isOver ? true : undefined}
                data-sorting={isSorting ? true : undefined}
                {...attributes}
                {...props}
            />
        </SortableItemContext.Provider>
    )
})
SortableItem.displayName = "SortableItem"

export const SortableItemTrigger = React.forwardRef<
    React.ElementRef<typeof Primitive.button>,
    React.ComponentPropsWithoutRef<typeof Primitive.button>
>(({ className, disabled: disabledProp, ...props }, ref) => {
    const { getNewIndex } = useSortableImplContext()

    const { id, disabled } = useSortableItemContext()

    const { listeners, setActivatorNodeRef, isDragging, isOver, isSorting } =
        useSortable({
            id,
            disabled: disabledProp || disabled,
            getNewIndex,
        })

    return (
        <Primitive.button
            ref={composeRefs(
                setActivatorNodeRef as React.RefCallback<HTMLButtonElement>,
                ref
            )}
            data-dragging={isDragging ? true : undefined}
            data-over={isOver ? true : undefined}
            data-sorting={isSorting ? true : undefined}
            disabled={disabledProp}
            className={cn("touch-none", className)}
            {...listeners}
            {...props}
        />
    )
})
SortableItemTrigger.displayName = "SortableItemTrigger"

export interface SortableOverlayProps
    extends Omit<
        React.ComponentPropsWithoutRef<typeof DragOverlay>,
        "children"
    > {
    children?: React.ReactNode | ((id: UniqueIdentifier) => React.ReactNode)
}

export const SortableOverlay = ({
    children,
    ...props
}: SortableOverlayProps) => {
    const { activeId } = useSortableImplContext()

    return (
        <PortalPrimitive.Root>
            <DragOverlay {...props}>
                {activeId &&
                    (typeof children === "function"
                        ? children(activeId)
                        : children)}
            </DragOverlay>
        </PortalPrimitive.Root>
    )
}
