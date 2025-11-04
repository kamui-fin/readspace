"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { motion } from "framer-motion"
import {
    SidebarLeftMenuSubButton,
    SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import { FeedDropdownMenu } from "../menus/FeedContextMenu"

interface SubFeedItemData {
    /** Unique identifier for the feed */
    id: string
    /** Display title of the feed */
    title: string
    /** URL path for navigation */
    url: string
    /** Unread count for the feed */
    count: number | null
    /** Feed icon/favicon URL */
    image?: string
    /** Whether this feed is currently active */
    isActive: boolean
    /** Whether this feed is favorited */
    isFavorite: boolean
}

interface SubFeedItemProps {
    /** Feed data object */
    item: SubFeedItemData
    /** Animation delay index for staggered animations */
    index: number
}

/**
 * Sub-feed item component for displaying individual feeds within folders.
 * Supports image fallbacks and animated mounting.
 */
export function SubFeedItem({ item, index }: SubFeedItemProps) {
    const [imageError, setImageError] = useState(false)

    /**
     * Handle image load error by setting fallback state
     */
    const handleImageError = () => {
        setImageError(true)
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15, delay: index * 0.03 }}
        >
            <SidebarMenuSubItem>
                <div className="flex items-center w-full group/item">
                    <SidebarLeftMenuSubButton
                        asChild
                        isActive={item.isActive}
                        className="py-0 flex-1"
                    >
                        <Link
                            href={item.url}
                            className="flex w-full items-center"
                            aria-label={`Navigate to ${item.title} feed`}
                        >
                            <div className="flex flex-grow items-center overflow-hidden pl-2">
                                {/* Feed favicon with fallback */}
                                {item.image && !imageError ? (
                                    <Image
                                        src={item.image}
                                        alt=""
                                        width={16}
                                        height={16}
                                        className="mr-2 h-4 w-4 shrink-0 rounded"
                                        onError={handleImageError}
                                    />
                                ) : (
                                    <div className="mr-2 h-4 w-4 shrink-0 rounded bg-primary/8" />
                                )}
                                <span className="truncate">{item.title}</span>
                            </div>
                        </Link>
                    </SidebarLeftMenuSubButton>

                    {/* Context menu and count */}
                    <div className="shrink-0 flex items-center pr-2">
                        <FeedDropdownMenu
                            isFolder={false}
                            itemActive={item.isActive}
                            itemId={item.id}
                            itemTitle={item.title}
                            isFavorite={item.isFavorite}
                            count={item.count}
                        />
                    </div>
                </div>
            </SidebarMenuSubItem>
        </motion.div>
    )
}

export type { SubFeedItemData }
