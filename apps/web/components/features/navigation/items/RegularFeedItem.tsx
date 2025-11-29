"use client"

import * as React from "react"
import Link from "next/link"
import { SidebarLeftMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"
import { FeedDropdownMenu } from "../menus/FeedContextMenu"
import { Inbox, Star } from "lucide-react"

interface RegularFeedItemData {
    /** Unique identifier for the feed */
    id: string
    /** Display title of the feed */
    title: string
    /** URL path for navigation */
    url: string
    /** Unread count for the feed */
    count: number | null
    /** Icon component for the feed */
    icon: React.ElementType | null
    /** Whether this feed is currently active */
    isActive: boolean
    /** Whether this feed is favorited */
    isFavorite: boolean
}

interface RegularFeedItemProps {
    /** Feed data object */
    feed: RegularFeedItemData
}

/**
 * Regular feed item component for displaying individual feeds outside of folders.
 * Supports special handling for the "All" feed and standard feed operations.
 */
export function RegularFeedItem({ feed }: RegularFeedItemProps) {
    const isAll = feed.id === "all"

    return (
        <SidebarMenuItem>
            <div className="flex items-center w-full group/item">
                <SidebarLeftMenuButton
                    asChild
                    className="justify-start flex-1"
                    isActive={feed.isActive}
                >
                    <Link
                        href={feed.url}
                        aria-label={`Navigate to ${feed.title} feed`}
                    >
                        <div className="flex flex-grow items-center overflow-hidden pl-2">
                            {/* Feed icon */}
                            {feed.icon &&
                                React.createElement(feed.icon, {
                                    className: "h-4 w-4 mr-1 shrink-0",
                                })}
                            {!feed.icon && isAll && (
                                <Inbox className="h-4 w-4 mr-1 shrink-0" />
                            )}
                            {!feed.icon && !isAll && (
                                <div className="w-4 mr-1 shrink-0" />
                            )}
                            <span className="ml-1 truncate">{feed.title}</span>
                            {/* Star indicator for favorited feeds */}
                            {feed.isFavorite && !isAll && (
                                <Star className="h-3 w-3 ml-2 shrink-0 fill-yellow-500 text-yellow-500" />
                            )}
                        </div>
                    </Link>
                </SidebarLeftMenuButton>

                {/* Context menu and count */}
                <div className="shrink-0 flex items-center pr-2">
                    <FeedDropdownMenu
                        isFolder={false}
                        itemActive={feed.isActive}
                        itemId={feed.id}
                        itemTitle={feed.title}
                        isFavorite={feed.isFavorite}
                        isAll={isAll}
                        count={feed.count}
                    />
                </div>
            </div>
        </SidebarMenuItem>
    )
}

export type { RegularFeedItemData }
