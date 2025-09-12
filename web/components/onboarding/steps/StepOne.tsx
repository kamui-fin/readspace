import { Button } from "@/components/ui/button"
import { CategoryBadge } from "@/components/ui/category-badge"
import { useOnboardingStore } from "@/stores/onboarding"
import { motion } from "framer-motion"
import React, { useState } from "react"
import OnboardingLayout from "../layout"

// Categories from discover page
const CATEGORIES = [
    "Technology & Programming",
    "Artificial Intelligence", 
    "Design & Creativity",
    "Business & Finance",
    "News & Politics",
    "Gaming & Entertainment",
    "Science & Research",
    "Lifestyle & Personal",
    "Culture & Arts",
    "Security & Privacy",
    "Education & Learning",
    "Miscellaneous"
]

const StepOne: React.FC = () => {
    const { onboardingData, updateOnboardingData, nextStep } = useOnboardingStore()
    const [selectedCategories, setSelectedCategories] = useState<string[]>(
        onboardingData.selectedCategories || []
    )

    const handleCategoryToggle = (category: string) => {
        const isSelected = selectedCategories.includes(category)
        const newCategories = isSelected
            ? selectedCategories.filter(c => c !== category)
            : [...selectedCategories, category]
        
        setSelectedCategories(newCategories)
    }

    const handleNext = () => {
        updateOnboardingData({ selectedCategories })
        nextStep()
    }

    const canProceed = selectedCategories.length > 0

    return (
        <OnboardingLayout
            title="What interests you?"
            subtitle="Select categories to help us find feeds you'll love"
        >
            <div className="flex flex-wrap gap-3 justify-center mb-8">
                {CATEGORIES.map((category, index) => (
                    <motion.div
                        key={category}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{
                            duration: 0.3,
                            delay: index * 0.05,
                            ease: "easeOut"
                        }}
                    >
                        <CategoryBadge
                            category={category}
                            onClick={() => handleCategoryToggle(category)}
                            selected={selectedCategories.includes(category)}
                        />
                    </motion.div>
                ))}
            </div>
            
            {selectedCategories.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center text-sm text-gray-600 mb-4"
                >
                    {selectedCategories.length} categor{selectedCategories.length === 1 ? 'y' : 'ies'} selected
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
