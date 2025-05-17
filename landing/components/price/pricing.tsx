"use client"

import { Heart, Zap } from "lucide-react"
import { useState } from "react"
import { PricingCard } from "./pricing-card"
import { PricingToggle } from "./pricing-toggle"

export function Pricing() {
    const [isYearly, setIsYearly] = useState(true) // Set to yearly by default

    const freeBenefits = [
        "Unlimited manual flashcards and spaced repetition",
        "Sync all progress and highlights across devices",
        "E-reader (unlimited local and 50MB cloud)",
        "3 reader assistant requests / day",
        "1 active recall session / day",
        "300 pages / month deep document processing",
    ]

    const proBenefits = [
        "Unlimited reader assistant",
        "Unlimited recall sessions",
        "Unlimited cloud storage",
        "Unlimited deep document processing",
        "AI personalization for learning that adapts to you",
    ]

    const monthlyPrice = 7.99
    const yearlyPrice = 5.99
    const monthlyOriginalPrice = 14.99
    const yearlyOriginalPrice = 10.99

    return (
        <div className="w-full">
            <div className="flex flex-col items-center mb-10">
                <PricingToggle isYearly={isYearly} setIsYearly={setIsYearly} />
            </div>

            <div className="relative max-w-4xl mx-auto">
                <div className="px-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <PricingCard
                            icon={<Heart className="h-6 w-6 text-[#386641]" />}
                            title="Free"
                            description="Perfect for getting started"
                            price="$0"
                            pricePeriod="/month"
                            features={freeBenefits}
                        />
                    </div>

                    <div className="md:relative md:-left-4 md:z-10">
                        <PricingCard
                            icon={<Zap className="h-6 w-6 text-[#386641]" />}
                            title="Pro"
                            description="For serious learners"
                            price={
                                isYearly
                                    ? `$${yearlyPrice}`
                                    : `$${monthlyPrice}`
                            }
                            pricePeriod="/month"
                            originalPrice={
                                isYearly
                                    ? yearlyOriginalPrice
                                    : monthlyOriginalPrice
                            }
                            features={proBenefits}
                            includesFree={true}
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}
