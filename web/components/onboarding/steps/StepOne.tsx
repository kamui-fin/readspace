import { Button } from "@/components/ui/button"
import { useOnboardingStore } from "@/stores/onboarding"
import { motion } from "framer-motion"
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
} from "lucide-react"
import React, { useState } from "react"
import OnboardingLayout from "../layout"

// Categories from discover page with icons
const CATEGORIES = [
    { name: "Technology & Programming", icon: Code2 },
    { name: "Artificial Intelligence", icon: Cpu },
    { name: "Design & Creativity", icon: Palette },
    { name: "Business & Finance", icon: TrendingUp },
    { name: "News & Politics", icon: Newspaper },
    { name: "Gaming & Entertainment", icon: Gamepad2 },
    { name: "Science & Research", icon: Microscope },
    { name: "Lifestyle & Personal", icon: Heart },
    { name: "Culture & Arts", icon: Paintbrush },
    { name: "Security & Privacy", icon: Shield },
    { name: "Education & Learning", icon: GraduationCap },
    { name: "Miscellaneous", icon: MoreHorizontal },
]

const getCategoryDescription = (categoryName: string) => {
    const descriptions: Record<string, string> = {
        "Technology & Programming": "Software dev, programming, tech news",
        "Artificial Intelligence": "AI research, machine learning, automation",
        "Design & Creativity": "UX/UI design, art, creative processes",
        "Business & Finance": "Market news, startup insights, economics",
        "News & Politics": "Current events, political analysis, journalism",
        "Gaming & Entertainment": "Video games, movies, pop culture",
        "Science & Research": "Research papers, discoveries, analysis",
        "Lifestyle & Personal":
            "Health, wellness, productivity, personal growth",
        "Culture & Arts": "Literature, music, cultural commentary",
        "Security & Privacy": "Cybersecurity, privacy rights, digital safety",
        "Education & Learning": "Online courses, tutorials, knowledge sharing",
        Miscellaneous: "Everything else that doesn't fit above",
    }
    return descriptions[categoryName] || ""
}

const getShortCategoryName = (categoryName: string) => {
    const shortNames: Record<string, string> = {
        "Technology & Programming": "Tech & Code",
        "Artificial Intelligence": "AI",
        "Design & Creativity": "Design",
        "Business & Finance": "Business",
        "News & Politics": "News",
        "Gaming & Entertainment": "Gaming",
        "Science & Research": "Science",
        "Lifestyle & Personal": "Lifestyle",
        "Culture & Arts": "Culture",
        "Security & Privacy": "Security",
        "Education & Learning": "Education",
        Miscellaneous: "Other",
    }
    return shortNames[categoryName] || categoryName
}

const StepOne: React.FC = () => {
    const { onboardingData, updateOnboardingData, nextStep } =
        useOnboardingStore()
    const [selectedCategories, setSelectedCategories] = useState<string[]>(
        onboardingData.selectedCategories || []
    )

    const handleCategoryToggle = (categoryName: string) => {
        const isSelected = selectedCategories.includes(categoryName)
        const newCategories = isSelected
            ? selectedCategories.filter((c) => c !== categoryName)
            : [...selectedCategories, categoryName]

        setSelectedCategories(newCategories)
    }

    const handleNext = () => {
        updateOnboardingData({ selectedCategories })
        nextStep()
    }

    const canProceed = selectedCategories.length > 0

    return (
        <OnboardingLayout
            title="What's your reading taste?"
            subtitle="Choose topics to build your personalized information diet"
        >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8 max-w-5xl mx-auto">
                {CATEGORIES.map((category, index) => {
                    const IconComponent = category.icon
                    const isSelected = selectedCategories.includes(
                        category.name
                    )

                    return (
                        <motion.div
                            key={category.name}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{
                                duration: 0.4,
                                delay: index * 0.08,
                                ease: "easeOut",
                            }}
                            className="w-full"
                        >
                            <button
                                onClick={() =>
                                    handleCategoryToggle(category.name)
                                }
                                className={`w-full p-5 h-[110px] rounded-xl border transition-all duration-200 text-left group hover:scale-[1.02] hover:shadow-sm ${
                                    isSelected
                                        ? "border-primary bg-primary/5 text-primary"
                                        : "border-border bg-background hover:border-border/60 hover:shadow-md text-foreground"
                                }`}
                            >
                                <div className="flex items-start gap-4 h-full">
                                    <div
                                        className={`p-2 rounded-lg transition-colors flex-shrink-0`}
                                    >
                                        <IconComponent
                                            size={20}
                                            className={`${
                                                isSelected
                                                    ? "text-primary"
                                                    : "text-muted-foreground group-hover:text-foreground"
                                            }`}
                                        />
                                    </div>
                                    <div className="flex-1 min-w-0 flex flex-col justify-between h-full py-1">
                                        <div>
                                            <div className="font-semibold text-base leading-tight mb-2">
                                                {getShortCategoryName(
                                                    category.name
                                                )}
                                            </div>
                                            <div
                                                className={`text-sm leading-snug transition-colors line-clamp-2 ${
                                                    isSelected
                                                        ? "text-primary/70"
                                                        : "text-muted-foreground group-hover:text-foreground/80"
                                                }`}
                                            >
                                                {getCategoryDescription(
                                                    category.name
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div
                                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200 flex-shrink-0 ${
                                            isSelected
                                                ? "border-primary bg-primary"
                                                : "border-muted-foreground/30 group-hover:border-muted-foreground/50"
                                        }`}
                                    >
                                        {isSelected && (
                                            <svg
                                                className="w-3 h-3 text-primary-foreground"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={3}
                                                    d="M5 13l4 4L19 7"
                                                />
                                            </svg>
                                        )}
                                    </div>
                                </div>
                            </button>
                        </motion.div>
                    )
                })}
            </div>

            {selectedCategories.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center text-sm text-gray-600 mb-4"
                >
                    {selectedCategories.length} topic
                    {selectedCategories.length === 1 ? "" : "s"} selected
                </motion.div>
            )}

            <div className="mt-6">
                <Button
                    onClick={handleNext}
                    disabled={!canProceed}
                    className="w-full bg-primary hover:bg-primary-light disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Continue
                </Button>
            </div>
        </OnboardingLayout>
    )
}

export default StepOne
