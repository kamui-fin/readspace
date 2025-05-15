"use client"

import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { ArrowUpDown, Filter, LayoutGrid, List, Search } from "lucide-react"

interface CatalogHeaderProps {
    viewMode: "grid" | "list"
    setViewMode: (mode: "grid" | "list") => void
    searchQuery: string
    setSearchQuery: (query: string) => void
    filter: string
    setFilter: (filter: string) => void
    sortBy: string
    setSortBy: (sortBy: string) => void
}

export function CatalogHeader({
    viewMode,
    setViewMode,
    searchQuery,
    setSearchQuery,
    filter,
    setFilter,
    sortBy,
    setSortBy,
}: CatalogHeaderProps) {
    return (
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between flex-wrap">
            <div className="relative flex-1 md:max-w-md min-w-[200px]">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    type="search"
                    placeholder="Search by title or author..."
                    className="pl-8"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            <div className="flex items-center gap-2">
                <Select value={filter} onValueChange={setFilter}>
                    <SelectTrigger className="w-[160px]">
                        <div className="flex items-center gap-2">
                            <Filter className="h-4 w-4 opacity-50" />
                            <SelectValue placeholder="Filter by" />
                        </div>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="in-progress">In Progress</SelectItem>
                        <SelectItem value="not-started">Not Started</SelectItem>
                    </SelectContent>
                </Select>

                <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-[160px]">
                        <div className="flex items-center gap-2">
                            <ArrowUpDown className="h-4 w-4 opacity-50" />
                            <SelectValue placeholder="Sort by" />
                        </div>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="dateAdded">Date Added</SelectItem>
                        <SelectItem value="title">Title</SelectItem>
                        <SelectItem value="author">Author</SelectItem>
                        <SelectItem value="progress">Progress</SelectItem>
                    </SelectContent>
                </Select>

                <ToggleGroup
                    type="single"
                    value={viewMode}
                    onValueChange={(value) =>
                        value && setViewMode(value as "grid" | "list")
                    }
                    className="hidden md:inline-flex"
                >
                    <ToggleGroupItem value="grid" aria-label="Grid view">
                        <LayoutGrid className="h-4 w-4" />
                    </ToggleGroupItem>
                    <ToggleGroupItem value="list" aria-label="List view">
                        <List className="h-4 w-4" />
                    </ToggleGroupItem>
                </ToggleGroup>
            </div>
        </div>
    )
}
