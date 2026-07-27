"use client"

import { Button } from "@/components/ui/button"
import { useOnboardingStore } from "@/stores/onboarding"
import { motion } from "framer-motion"
import React, { useState } from "react"
import OnboardingLayout from "../OnboardingLayout"
import { CATEGORY_CONFIG } from "@/lib/categories"
import { FeedCategory } from "@readspace/shared"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

const CATEGORY_GROUPS = [
    {
        id: "tech_science",
        title: "Tech & Science",
        categories: [
            FeedCategory.CONSUMER_TECH_DIGITAL,
            FeedCategory.SOFTWARE_ENGINEERING,
            FeedCategory.SCIENCE_NATURE,
            FeedCategory.GAMING,
        ],
    },
    {
        id: "news_business",
        title: "News & Business",
        categories: [
            FeedCategory.NEWS_CURRENT_EVENTS,
            FeedCategory.BUSINESS_FINANCE,
            FeedCategory.SOCIETY_LAW_HISTORY,
            FeedCategory.REGIONAL_LOCAL,
            FeedCategory.INDUSTRY_PROFESSIONS,
        ],
    },
    {
        id: "culture_leisure",
        title: "Culture & Leisure",
        categories: [
            FeedCategory.ARTS_CULTURE,
            FeedCategory.ENTERTAINMENT,
            FeedCategory.FOOD_DRINK,
            FeedCategory.TRAVEL_GEOGRAPHY,
            FeedCategory.SPORTS,
            FeedCategory.AUTOMOTIVE_TRANSPORT,
        ],
    },
    {
        id: "life_community",
        title: "Life & Community",
        categories: [
            FeedCategory.HEALTH_WELLNESS,
            FeedCategory.FAMILY_RELATIONSHIPS,
            FeedCategory.HOME_HOBBIES,
            FeedCategory.STYLE_SHOPPING,
            FeedCategory.IDENTITY_COMMUNITY,
        ],
    },
]

const CategorySelectionStep: React.FC = () => {
    const { onboardingData, updateOnboardingData, nextStep } =
        useOnboardingStore()
    const [selectedCategories, setSelectedCategories] = useState<string[]>(
        onboardingData.selectedCategories || []
    )

    const handleCategoryToggle = (categoryKey: string) => {
        const isSelected = selectedCategories.includes(categoryKey)
        const newCategories = isSelected
            ? selectedCategories.filter((c) => c !== categoryKey)
            : [...selectedCategories, categoryKey]

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
            <Tabs defaultValue="tech_science" className="w-full">
                <div className="flex justify-center mb-8">
                    <TabsList className="bg-muted/80 p-1 rounded-xl h-11 border border-border/40 shadow-xs flex gap-1">
                        {CATEGORY_GROUPS.map((group) => (
                            <TabsTrigger
                                key={group.id}
                                value={group.id}
                                className="rounded-lg px-4 py-1.5 text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm cursor-pointer select-none"
                            >
                                {group.title}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </div>

                {CATEGORY_GROUPS.map((group) => (
                    <TabsContent
                        key={group.id}
                        value={group.id}
                        className="mt-0 focus-visible:ring-0"
                    >
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8 max-w-5xl mx-auto">
                            {group.categories.map((catKey, index) => {
                                const category = CATEGORY_CONFIG[catKey]
                                const IconComponent = category.icon
                                const isSelected =
                                    selectedCategories.includes(catKey)

                                return (
                                    <motion.div
                                        key={category.name}
                                        initial={{ opacity: 0, y: 6 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{
                                            duration: 0.25,
                                            delay: index * 0.03,
                                            ease: [0.16, 1, 0.3, 1],
                                        }}
                                        className="w-full"
                                    >
                                        <button
                                            onClick={() =>
                                                handleCategoryToggle(catKey)
                                            }
                                            className={`w-full p-4 h-[95px] rounded-xl border transition-all duration-200 text-left group hover:scale-[1.01] hover:shadow-xs cursor-pointer ${
                                                isSelected
                                                    ? "border-primary bg-primary/5 text-primary"
                                                    : "border-border/60 bg-white dark:bg-zinc-900 hover:border-border hover:shadow-sm text-foreground"
                                            }`}
                                        >
                                            <div className="flex items-start gap-3 h-full">
                                                <div
                                                    className={`p-1.5 rounded-lg flex-shrink-0 transition-colors ${
                                                        isSelected
                                                            ? "bg-primary/10"
                                                            : "bg-muted"
                                                    }`}
                                                >
                                                    <IconComponent
                                                        size={18}
                                                        className={
                                                            isSelected
                                                                ? "text-primary"
                                                                : "text-muted-foreground group-hover:text-foreground"
                                                        }
                                                    />
                                                </div>
                                                <div className="flex-1 min-w-0 flex flex-col justify-between h-full py-0.5">
                                                    <div>
                                                        <div className="font-semibold text-sm leading-tight mb-1 text-foreground">
                                                            {category.shortName}
                                                        </div>
                                                        <div
                                                            className={`text-xs leading-normal line-clamp-2 transition-colors ${
                                                                isSelected
                                                                    ? "text-primary/80"
                                                                    : "text-muted-foreground group-hover:text-foreground/70"
                                                            }`}
                                                        >
                                                            {
                                                                category.description
                                                            }
                                                        </div>
                                                    </div>
                                                </div>
                                                <div
                                                    className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all duration-200 flex-shrink-0 ${
                                                        isSelected
                                                            ? "border-primary bg-primary"
                                                            : "border-muted-foreground/30 group-hover:border-muted-foreground/50"
                                                    }`}
                                                >
                                                    {isSelected && (
                                                        <svg
                                                            className="w-2.5 h-2.5 text-primary-foreground"
                                                            fill="none"
                                                            viewBox="0 0 24 24"
                                                            stroke="currentColor"
                                                        >
                                                            <path
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                                strokeWidth={
                                                                    3.5
                                                                }
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
                    </TabsContent>
                ))}
            </Tabs>

            <div className="mt-10 w-full flex justify-center">
                <Button
                    onClick={handleNext}
                    disabled={!canProceed}
                    className="w-48 h-12 bg-primary hover:bg-primary/95 text-white font-semibold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer select-none transition-all shadow-xs"
                >
                    Continue
                </Button>
            </div>
        </OnboardingLayout>
    )
}

export default CategorySelectionStep
