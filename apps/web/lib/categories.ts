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
    Car,
    Users,
    Coffee,
    Home,
    Globe,
    Scale,
    ShoppingBag,
    Plane,
    Wrench,
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
    [FeedCategory.ARTS_CULTURE]: {
        id: "arts_culture",
        name: "Arts & Culture",
        icon: Paintbrush,
        description: "Literature, music, cultural commentary",
        shortName: "Culture",
    },
    [FeedCategory.AUTOMOTIVE_TRANSPORT]: {
        id: "automotive",
        name: "Automotive",
        icon: Car,
        description: "Cars, transportation, mechanics",
        shortName: "Auto",
    },
    [FeedCategory.BUSINESS_FINANCE]: {
        id: "business",
        name: "Business & Finance",
        icon: TrendingUp,
        description: "Market news, startup insights, economics",
        shortName: "Business",
    },
    [FeedCategory.CONSUMER_TECH_DIGITAL]: {
        id: "tech",
        name: "Tech & Digital",
        icon: Code2,
        description: "Gadgets, digital trends, consumer tech",
        shortName: "Tech",
    },
    [FeedCategory.ENTERTAINMENT]: {
        id: "entertainment",
        name: "Entertainment",
        icon: Gamepad2, // Using Gamepad as generic entertainment or maybe Film/Music if available?
        description: "Movies, tv, celebrities, pop culture",
        shortName: "Entertainment",
    },
    [FeedCategory.FAMILY_RELATIONSHIPS]: {
        id: "family",
        name: "Family & Relationships",
        icon: Users,
        description: "Parenting, relationships, family life",
        shortName: "Family",
    },
    [FeedCategory.FOOD_DRINK]: {
        id: "food",
        name: "Food & Drink",
        icon: Coffee,
        description: "Recipes, restaurants, culinary arts",
        shortName: "Food",
    },
    [FeedCategory.GAMING]: {
        id: "gaming",
        name: "Gaming",
        icon: Gamepad2,
        description: "Video games, esports, game dev",
        shortName: "Gaming",
    },
    [FeedCategory.HEALTH_WELLNESS]: {
        id: "health",
        name: "Health & Wellness",
        icon: Heart,
        description: "Medical news, fitness, mental health",
        shortName: "Health",
    },
    [FeedCategory.HOME_HOBBIES]: {
        id: "home",
        name: "Home & Hobbies",
        icon: Home,
        description: "DIY, gardening, home improvement",
        shortName: "Home",
    },
    [FeedCategory.IDENTITY_COMMUNITY]: {
        id: "identity",
        name: "Identity & Community",
        icon: Users,
        description: "Community groups, social identity, forums",
        shortName: "Community",
    },
    [FeedCategory.INDUSTRY_PROFESSIONS]: {
        id: "industry",
        name: "Industry & Professions",
        icon: Wrench,
        description: "Professional fields, trades, specific industries",
        shortName: "Industry",
    },
    [FeedCategory.NEWS_CURRENT_EVENTS]: {
        id: "news",
        name: "News & Politics",
        icon: Newspaper,
        description: "Current events, political analysis, journalism",
        shortName: "News",
    },
    [FeedCategory.REGIONAL_LOCAL]: {
        id: "regional",
        name: "Regional & Local",
        icon: Globe,
        description: "Local news, regional updates",
        shortName: "Local",
    },
    [FeedCategory.SCIENCE_NATURE]: {
        id: "science",
        name: "Science & Nature",
        icon: Microscope,
        description: "Research papers, discoveries, environment",
        shortName: "Science",
    },
    [FeedCategory.SOCIETY_LAW_HISTORY]: {
        id: "society",
        name: "Society & History",
        icon: Scale,
        description: "Social issues, history, law",
        shortName: "Society",
    },
    [FeedCategory.SOFTWARE_ENGINEERING]: {
        id: "software",
        name: "Software Engineering",
        icon: Code2,
        description: "Programming, software development, devops",
        shortName: "Code",
    },
    [FeedCategory.SPORTS]: {
        id: "sports",
        name: "Sports",
        icon: TrendingUp, // Using TrendingUp as Trophy placeholder
        description: "Sports news, scores, teams",
        shortName: "Sports",
    },
    [FeedCategory.STYLE_SHOPPING]: {
        id: "style",
        name: "Style & Shopping",
        icon: ShoppingBag,
        description: "Fashion, shopping, trends",
        shortName: "Style",
    },
    [FeedCategory.TRAVEL_GEOGRAPHY]: {
        id: "travel",
        name: "Travel",
        icon: Plane,
        description: "Destinations, travel tips, geography",
        shortName: "Travel",
    },
    [FeedCategory.MISCELLANEOUS]: {
        id: "misc",
        name: "Miscellaneous",
        icon: MoreHorizontal,
        description: "Everything else",
        shortName: "Misc",
    },
}

export const CATEGORY_LIST = Object.values(CATEGORY_CONFIG)

