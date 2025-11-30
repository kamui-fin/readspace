import {
    Code2,
    Cpu,
    Gamepad2,
    GraduationCap,
    Heart,
    Microscope,
    MoreHorizontal,
    Newspaper,
    Paintbrush,
    Palette,
    Shield,
    TrendingUp,
    type LucideIcon,
} from "lucide-react"

import { FeedCategory } from "@readspace/shared"

export interface CategoryConfig {
    name: string
    icon: LucideIcon
    description: string
    shortName: string
    id: string
}

export const CATEGORY_CONFIG: Record<FeedCategory, CategoryConfig> = {
    "Technology & Programming": {
        id: "technology",
        name: "Technology & Programming",
        icon: Code2,
        description: "Software dev, programming, tech news",
        shortName: "Tech & Code",
    },
    "Artificial Intelligence": {
        id: "ai",
        name: "Artificial Intelligence",
        icon: Cpu,
        description: "AI research, machine learning, automation",
        shortName: "AI",
    },
    "Design & Creativity": {
        id: "design",
        name: "Design & Creativity",
        icon: Palette,
        description: "UX/UI design, art, creative processes",
        shortName: "Design",
    },
    "Business & Finance": {
        id: "business",
        name: "Business & Finance",
        icon: TrendingUp,
        description: "Market news, startup insights, economics",
        shortName: "Business",
    },
    "News & Politics": {
        id: "news",
        name: "News & Politics",
        icon: Newspaper,
        description: "Current events, political analysis, journalism",
        shortName: "News",
    },
    "Gaming & Entertainment": {
        id: "gaming",
        name: "Gaming & Entertainment",
        icon: Gamepad2,
        description: "Video games, movies, pop culture",
        shortName: "Gaming",
    },
    "Science & Research": {
        id: "science",
        name: "Science & Research",
        icon: Microscope,
        description: "Research papers, discoveries, analysis",
        shortName: "Science",
    },
    "Lifestyle & Personal": {
        id: "lifestyle",
        name: "Lifestyle & Personal",
        icon: Heart,
        description: "Health, wellness, productivity, personal growth",
        shortName: "Lifestyle",
    },
    "Culture & Arts": {
        id: "culture",
        name: "Culture & Arts",
        icon: Paintbrush,
        description: "Literature, music, cultural commentary",
        shortName: "Culture",
    },
    "Security & Privacy": {
        id: "security",
        name: "Security & Privacy",
        icon: Shield,
        description: "Cybersecurity, privacy rights, digital safety",
        shortName: "Security",
    },
    "Education & Learning": {
        id: "education",
        name: "Education & Learning",
        icon: GraduationCap,
        description: "Online courses, tutorials, knowledge sharing",
        shortName: "Education",
    },
    Miscellaneous: {
        id: "misc",
        name: "Miscellaneous",
        icon: MoreHorizontal,
        description: "Everything else that doesn't fit above",
        shortName: "Other",
    },
}

export const CATEGORY_LIST = Object.values(CATEGORY_CONFIG)
