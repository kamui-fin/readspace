"use client"

import type React from "react"

import { Input } from "@/components/ui/input"
import { useReaderStore } from "@/stores/reader"
import { useState } from "react"

interface PageNumberInputProps {
    onPageChange?: (page: number) => void
}

export default function PageNumberInput({
    onPageChange = () => {},
}: PageNumberInputProps) {
    // Get current page and total pages from reader store
    const currentPage = useReaderStore((state) => state.currentPage)
    const totalPages = useReaderStore((state) => state.totalPages)
    const setCurrentPage = useReaderStore((state) => state.setCurrentPage)

    // Only use local state when actively editing
    const [isEditing, setIsEditing] = useState(false)
    const [tempValue, setTempValue] = useState("")

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        // Allow only numbers
        const value = e.target.value.replace(/[^0-9]/g, "")
        setTempValue(value)
    }

    const handleInputFocus = () => {
        setIsEditing(true)
        setTempValue((currentPage || 1).toString())
    }

    const handleInputBlur = () => {
        let newPage = Number.parseInt(tempValue, 10)

        // Handle empty input or invalid numbers
        if (isNaN(newPage) || newPage < 1) {
            newPage = 1
        } else if (newPage > (totalPages || 1)) {
            newPage = totalPages || 1
        }

        // Update the page in the store
        setCurrentPage(newPage)
        onPageChange(newPage)
        setIsEditing(false)
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.currentTarget.blur()
        }
    }

    return (
        <div className="flex items-center justify-center space-x-1">
            <div className="flex items-center">
                <Input
                    type="text"
                    value={
                        isEditing ? tempValue : (currentPage || 1).toString()
                    }
                    onChange={handleInputChange}
                    onFocus={handleInputFocus}
                    onBlur={handleInputBlur}
                    onKeyDown={handleKeyDown}
                    className="w-12 h-6 text-center text-xs px-1"
                    aria-label="Current page"
                />
                <span className="mx-1 text-xs text-muted-foreground">
                    of {totalPages || 1}
                </span>
            </div>
        </div>
    )
}
