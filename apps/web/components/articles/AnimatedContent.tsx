"use client"

import { motion, AnimatePresence } from "framer-motion"
import { ReactNode } from "react"

interface AnimatedContentProps {
    children: ReactNode
    contentKey: string | number
    className?: string
}

export function AnimatedContent({
    children,
    contentKey,
    className = "",
}: AnimatedContentProps) {
    return (
        <AnimatePresence mode="wait">
            <motion.div
                key={contentKey}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{
                    duration: 0.4,
                    ease: [0.4, 0, 0.2, 1], // Smooth easing
                }}
                className={className}
            >
                {children}
            </motion.div>
        </AnimatePresence>
    )
}
