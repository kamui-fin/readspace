"use client"

import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarLeftTrigger } from "@/components/ui/sidebar"
import { motion } from "framer-motion"
import React from "react"

interface HeaderProps {
    // Ensure href is optional as the last item might not have one
    breadcrumbItems: { label: string; href?: string }[]
    children?: React.ReactNode
    classAttributes?: string
    rightContent?: React.ReactNode
}

const container = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1,
        },
    },
}

const breadcrumbItem = {
    hidden: { opacity: 0, y: -10 },
    show: { opacity: 1, y: 0 },
}

const Header: React.FC<HeaderProps> = ({
    classAttributes = "",
    children,
    rightContent,
    breadcrumbItems,
}) => {
    return (
        <header
            className={`${classAttributes} flex h-12 max-w-full shrink-0 items-center justify-between gap-2 transition-all pr-2`}
        >
            <div className="flex items-center gap-2 pl-4 flex-1 min-w-0">
                <SidebarLeftTrigger className="-ml-1" />
                {breadcrumbItems.length > 0 && (
                    <Separator orientation="vertical" className="h-4" />
                )}
                <Breadcrumb className="overflow-hidden whitespace-nowrap">
                    <BreadcrumbList>
                        <motion.div
                            variants={container}
                            initial="hidden"
                            animate="show"
                            className="flex items-center gap-3"
                        >
                            {breadcrumbItems.map((breadcrumb, index) => (
                                <React.Fragment key={index}>
                                    {index > 0 && (
                                        <motion.div variants={breadcrumbItem}>
                                            <BreadcrumbSeparator />
                                        </motion.div>
                                    )}
                                    <motion.div variants={breadcrumbItem}>
                                        <BreadcrumbItem>
                                            {index ===
                                            breadcrumbItems.length - 1 ? (
                                                <BreadcrumbPage className="block truncate">
                                                    {breadcrumb.label}
                                                </BreadcrumbPage>
                                            ) : (
                                                <BreadcrumbLink
                                                    href={breadcrumb.href}
                                                >
                                                    {breadcrumb.label}
                                                </BreadcrumbLink>
                                            )}
                                        </BreadcrumbItem>
                                    </motion.div>
                                </React.Fragment>
                            ))}
                        </motion.div>
                    </BreadcrumbList>
                </Breadcrumb>
            </div>
            <div className="pl-3 flex gap-4 items-center">
                {rightContent}
                {children}
            </div>
        </header>
    )
}

export default Header
