import { Button } from "@/components/ui/button"
import Link from "next/link"
import OnboardingLayout from "../OnboardingLayout"

export function OnboardingLoadingState() {
    return (
        <OnboardingLayout
            title="Curating your newsfeed..."
            subtitle="Finding quality sources that match your interests"
        >
            <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                    <div
                        key={i}
                        className="bg-card border border-border rounded-xl p-4 animate-pulse"
                    >
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 bg-muted rounded-xl"></div>
                            <div className="flex-1">
                                <div className="flex items-start justify-between gap-3 mb-2">
                                    <div className="h-5 bg-muted rounded w-3/4"></div>
                                    <div className="w-16 h-8 bg-muted rounded"></div>
                                </div>
                                <div className="h-3 bg-muted/70 rounded w-1/2 mb-2"></div>
                                <div className="h-4 bg-muted/70 rounded w-full"></div>
                                <div className="h-4 bg-muted/70 rounded w-2/3 mt-1"></div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </OnboardingLayout>
    )
}

interface OnboardingErrorStateProps {
    onBack: () => void
}

export function OnboardingErrorState({ onBack }: OnboardingErrorStateProps) {
    return (
        <OnboardingLayout
            title="Having trouble finding sources"
            subtitle="We couldn't load publications for your selected topics. Let's try again."
        >
            <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">
                    We couldn&apos;t load publications for your selected topics.
                </p>
                <div className="flex gap-3">
                    <Button
                        onClick={onBack}
                        variant="outline"
                        className="flex-1"
                    >
                        Go Back
                    </Button>
                    <Button
                        asChild
                        className="flex-1 bg-primary hover:bg-primary-light"
                    >
                        <Link href="/today">Continue Anyway</Link>
                    </Button>
                </div>
            </div>
        </OnboardingLayout>
    )
}
