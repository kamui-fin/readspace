"use client"

import { Badge } from "@/components/ui/badge"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { env } from "@/env"
import { useUpgradeDialog } from "@/stores/upgrade-dialog"
import {
    Check,
    Rss,
    Sparkles,
    Search,
    BookOpen,
    Rocket,
    X,
} from "lucide-react"
import { useState } from "react"
import { SubscribeButton } from "./billing/SubscribeButton"

export default function UpgradeDialog() {
    const [selectedPlan, setSelectedPlan] = useState("yearly")
    const { isOpen, title, description, close } = useUpgradeDialog()

    const MONTHLY_PRICE_ID = env.NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID || "price_mock_monthly_799"
    const YEARLY_PRICE_ID = env.NEXT_PUBLIC_STRIPE_YEARLY_PRICE_ID || "price_mock_yearly_599"

    return (
        <Dialog open={isOpen} onOpenChange={close}>
            <DialogContent className="z-9999 w-full max-w-sm sm:max-w-md md:max-w-lg lg:max-w-[600px] p-0 overflow-hidden max-h-[85vh] overflow-y-auto bg-background border-border">
                <button
                    onClick={close}
                    className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground z-10 text-muted-foreground"
                >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Close</span>
                </button>

                <div className="flex flex-col">
                    {/* Header section - Theme-aware light green in light mode, primary tint in dark mode */}
                    <div className="bg-primary/5 dark:bg-primary/10 border-b border-border p-6">
                        <div className="flex items-start gap-4">
                            <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                                <Rocket className="h-5 w-5 text-primary-foreground" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
                                    {title}
                                </DialogTitle>
                                <p className="text-muted-foreground text-sm mt-1">
                                    {description}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Features section - High-appeal SaaS typography */}
                    <div className="p-6 border-b border-border bg-card text-card-foreground">
                        <h3 className="font-semibold text-xs uppercase text-muted-foreground tracking-wide mb-4">
                            Readspace Pro benefits
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Benefit 1: Feed capacity */}
                            <div className="flex items-start">
                                <div className="mr-3 h-5 w-5 flex-shrink-0 text-primary mt-0.5">
                                    <Rss className="h-5 w-5" />
                                </div>
                                <div>
                                    <span className="font-semibold text-sm sm:text-base text-foreground">
                                        Up to 1000 feeds
                                    </span>
                                    <p className="text-sm text-muted-foreground mt-0.5">
                                        Follow all your favorite creators, newsletters, & blogs.
                                    </p>
                                </div>
                            </div>
                            
                            {/* Benefit 2: AI Summaries */}
                            <div className="flex items-start">
                                <div className="mr-3 h-5 w-5 flex-shrink-0 text-primary mt-0.5">
                                    <Sparkles className="h-5 w-5" />
                                </div>
                                <div>
                                    <span className="font-semibold text-sm sm:text-base text-foreground">
                                        100 AI reader tools / day
                                    </span>
                                    <p className="text-sm text-muted-foreground mt-0.5">
                                        Summarize or translate long-form writing instantly.
                                    </p>
                                </div>
                            </div>
                            
                            {/* Benefit 3: Intelligent discovery */}
                            <div className="flex items-start">
                                <div className="mr-3 h-5 w-5 flex-shrink-0 text-primary mt-0.5">
                                    <Search className="h-5 w-5" />
                                </div>
                                <div>
                                    <span className="font-semibold text-sm sm:text-base text-foreground">
                                        Intelligent discovery
                                    </span>
                                    <p className="text-sm text-muted-foreground mt-0.5">
                                        Search and filter articles using natural conversational AI.
                                    </p>
                                </div>
                            </div>
                            
                            {/* Benefit 4: Reading Library */}
                            <div className="flex items-start">
                                <div className="mr-3 h-5 w-5 flex-shrink-0 text-primary mt-0.5">
                                    <BookOpen className="h-5 w-5" />
                                </div>
                                <div>
                                    <span className="font-semibold text-sm sm:text-base text-foreground">
                                        Personal reading library
                                    </span>
                                    <p className="text-sm text-muted-foreground mt-0.5">
                                        Keep bookmarks, highlights, and custom notes synced forever.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Plans section */}
                    <div className="p-6 pt-6 bg-background text-foreground">
                        <h3 className="font-semibold mb-4 text-sm sm:text-base">Choose your plan</h3>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                            {/* Pro Monthly Card */}
                            <div>
                                <Card
                                    className={`border-2 cursor-pointer transition-all overflow-hidden relative h-full bg-card hover:border-primary/50 ${
                                        selectedPlan === "monthly"
                                            ? "border-primary bg-primary/5 dark:bg-primary/10"
                                            : "border-border"
                                    }`}
                                    onClick={() => setSelectedPlan("monthly")}
                                >
                                    {selectedPlan === "monthly" && (
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                                            <Check className="h-4 w-4 text-primary-foreground" />
                                        </div>
                                    )}
                                    <CardHeader className="pb-2 p-4 sm:p-5">
                                        <div>
                                            <CardTitle className="text-base sm:text-lg font-bold text-foreground">
                                                Pro Monthly
                                            </CardTitle>
                                            <CardDescription className="text-xs sm:text-sm text-muted-foreground">
                                                Billed monthly
                                            </CardDescription>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="px-4 pb-4 sm:px-5 sm:pb-5">
                                        <div className="flex items-baseline">
                                            <span className="text-2xl sm:text-3xl font-extrabold text-foreground">
                                                $7.99
                                            </span>
                                            <span className="text-muted-foreground text-xs sm:text-sm ml-1">
                                                /month
                                            </span>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Pro Yearly Card */}
                            <div className="relative">
                                <div className="absolute left-0 right-0 flex justify-center -top-3 z-20">
                                    <Badge className="rounded-full px-3 bg-primary text-primary-foreground hover:bg-primary/95 text-[10px] sm:text-xs font-semibold shadow-xs">
                                        Save 25%
                                    </Badge>
                                </div>
                                <Card
                                    className={`border-2 cursor-pointer transition-all overflow-hidden relative h-full bg-card hover:border-primary/50 ${
                                        selectedPlan === "yearly"
                                            ? "border-primary bg-primary/5 dark:bg-primary/10"
                                            : "border-border"
                                    }`}
                                    onClick={() => setSelectedPlan("yearly")}
                                >
                                    {selectedPlan === "yearly" && (
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                                            <Check className="h-4 w-4 text-primary-foreground" />
                                        </div>
                                    )}

                                    <CardHeader className="pb-2 p-4 sm:p-5">
                                        <div>
                                            <CardTitle className="text-base sm:text-lg font-bold text-foreground">
                                                Pro Yearly
                                            </CardTitle>
                                            <CardDescription className="text-xs sm:text-sm text-muted-foreground">
                                                Billed annually
                                            </CardDescription>
                                        </div>
                                    </CardHeader>

                                    <CardContent className="px-4 pb-4 sm:px-5 sm:pb-5">
                                        <div className="flex items-baseline">
                                            <span className="text-2xl sm:text-3xl font-extrabold text-foreground">
                                                $5.99
                                            </span>
                                            <span className="text-muted-foreground text-xs sm:text-sm ml-1">
                                                /month
                                            </span>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>

                        <SubscribeButton
                            priceId={
                                selectedPlan === "monthly"
                                    ? MONTHLY_PRICE_ID
                                    : YEARLY_PRICE_ID
                            }
                            className="w-full flex justify-center items-center py-2.5 h-10 text-sm font-semibold hover:bg-primary/90 transition-colors shadow-xs"
                        >
                            <Rocket className="mr-2 h-4 w-4" />
                            {`Upgrade to Pro ${selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1)}`}
                        </SubscribeButton>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
