"use client"

import { Button } from "@/components/ui/button"
import { Loader } from "@/components/ui/loader"
import { downloadOPML, generateOPMLContent } from "@/lib/opml-export"
import { useUpgradeDialog } from "@/stores/upgrade-dialog"
import {
    isNewsletterFeedUrl,
    useFeeds,
    useResolveDowngrade,
    type OverLimitState,
    type SubscriptionResponse,
} from "@readspace/shared"
import { useMemo, useState } from "react"
import { toast } from "react-hot-toast"
import { DowngradeLayout } from "./DowngradeLayout"
import { ExportStep } from "./steps/ExportStep"
import { KeepFeedsStep } from "./steps/KeepFeedsStep"
import { ReviewStep } from "./steps/ReviewStep"
import { WelcomeStep } from "./steps/WelcomeStep"

type StepId = "welcome" | "export" | "keep" | "review"

const STEP_LABELS: Record<StepId, string> = {
    welcome: "What changes",
    export: "Export",
    keep: "Choose feeds",
    review: "Review",
}

interface DowngradeFlowProps {
    overLimit: OverLimitState
}

/**
 * Full-screen, non-dismissable flow shown when a user's plan dropped (e.g. Pro -> Free) and
 * they still hold more than it allows: goodbye -> optional OPML export -> pick feeds to keep ->
 * review. The server refuses content endpoints until this resolves, so there's no way around it.
 */
export function DowngradeFlow({ overLimit }: DowngradeFlowProps) {
    const { data, isLoading, isSuccess, isFetching, refetch } = useFeeds()
    const resolveDowngrade = useResolveDowngrade()
    const openUpgradeDialog = useUpgradeDialog((state) => state.open)

    const [stepIndex, setStepIndex] = useState(0)
    const [hasExported, setHasExported] = useState(false)
    const [picked, setPicked] = useState<Set<string>>(new Set())

    // Newsletters are the virtual email feeds (newsletter:// URLs), the same test the server uses,
    // so every count on screen matches what resolve will actually do.
    const { regularFeeds, newsletterCount } = useMemo(() => {
        const subs = (data?.subscriptions ?? []) as SubscriptionResponse[]
        const regular = subs.filter((sub) => !isNewsletterFeedUrl(sub.feed.url))
        return {
            regularFeeds: regular,
            newsletterCount: subs.length - regular.length,
        }
    }, [data?.subscriptions])
    const feedLimit = overLimit.subscriptions.limit
    // Only ask the user to choose when their regular feeds alone exceed the cap; otherwise
    // (e.g. only newsletters are over) every regular feed is kept.
    const needsPick = feedLimit !== -1 && regularFeeds.length > feedLimit
    const keepIds = needsPick
        ? picked
        : new Set(regularFeeds.map((sub) => sub.feed.id))

    const steps: StepId[] = needsPick
        ? ["welcome", "export", "keep", "review"]
        : ["welcome", "export", "review"]
    const step = steps[Math.min(stepIndex, steps.length - 1)] ?? "welcome"
    const next = () => setStepIndex((i) => Math.min(i + 1, steps.length - 1))
    const back = () => setStepIndex((i) => Math.max(i - 1, 0))

    const togglePick = (feedId: string) => {
        setPicked((prev) => {
            const nextPicked = new Set(prev)
            if (nextPicked.has(feedId)) nextPicked.delete(feedId)
            else if (nextPicked.size < feedLimit) nextPicked.add(feedId)
            return nextPicked
        })
    }

    const handleExport = () => {
        try {
            const opml = generateOPMLContent(
                regularFeeds.map((sub) => ({
                    url: sub.feed.url,
                    title: sub.custom_title || sub.feed.title,
                    link: sub.feed.link,
                    folder_id: sub.folder?.id,
                })),
                data?.folders ?? []
            )
            downloadOPML(opml)
            setHasExported(true)
        } catch (error) {
            console.error("OPML export failed:", error)
            toast.error("Couldn't create the export file. Please try again.")
        }
    }

    const handleConfirm = () => {
        if (!isSuccess || !data || resolveDowngrade.isPending) return
        return toast.promise(
            resolveDowngrade.mutateAsync({ keep_feed_ids: [...keepIds] }),
            {
                loading: "Updating your feeds...",
                success: "You're all set on Free",
                error: (err) =>
                    err?.message || "Something went wrong. Please try again.",
            }
        )
    }

    if (isLoading) {
        return (
            <div
                className="flex h-dvh w-full items-center justify-center bg-background"
                aria-busy
            >
                <Loader
                    variant="circular"
                    size="lg"
                    className="size-5 border-[3px] border-secondary border-t-transparent [animation:spin_0.45s_linear_infinite]"
                />
            </div>
        )
    }

    if (!isSuccess || !data) {
        return (
            <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6">
                <p role="alert">
                    Couldn't load your feeds. Please retry before continuing.
                </p>
                <Button onClick={() => refetch()} disabled={isFetching}>
                    {isFetching ? "Retrying..." : "Retry"}
                </Button>
            </div>
        )
    }

    const backButton = (
        <Button
            variant="link"
            className="h-auto self-center px-0 text-muted-foreground hover:text-foreground sm:self-auto"
            onClick={back}
            disabled={resolveDowngrade.isPending}
        >
            Back
        </Button>
    )
    const layoutProps = {
        steps: steps.map((id) => STEP_LABELS[id]),
        step: stepIndex + 1,
        onStepSelect: (n: number) => setStepIndex(n - 1),
    }
    const savedCount = overLimit.saved_articles.usage
    const folderCount = new Set(
        regularFeeds.map((sub) => sub.folder?.id).filter(Boolean)
    ).size

    switch (step) {
        case "welcome":
            return (
                <DowngradeLayout
                    {...layoutProps}
                    title="Your Pro plan has ended"
                    subtitle="Thanks for reading with Pro. Here is what the Free plan keeps, and what it asks you to let go of. It takes about a minute."
                    footer={
                        <>
                            <Button
                                variant="link"
                                className="h-auto self-center px-0 text-muted-foreground underline-offset-4 hover:text-foreground sm:self-auto"
                                onClick={() =>
                                    openUpgradeDialog({
                                        title: "Welcome back to Pro",
                                        description:
                                            "Pick up right where you left off, with every feed and newsletter intact.",
                                    })
                                }
                            >
                                Resubscribe instead
                            </Button>
                            <Button onClick={next}>Continue on Free</Button>
                        </>
                    }
                >
                    <WelcomeStep
                        feedCount={regularFeeds.length}
                        feedLimit={feedLimit}
                        newsletterCount={newsletterCount}
                        savedCount={savedCount}
                        savedLimit={overLimit.saved_articles.limit}
                    />
                </DowngradeLayout>
            )
        case "export":
            return (
                <DowngradeLayout
                    {...layoutProps}
                    title="Take your feeds with you"
                    subtitle="Download your full list as OPML before anything changes. If you come back to Pro, import it and every feed returns to its folder. Any RSS reader can open it too."
                    footer={
                        <>
                            {backButton}
                            <Button
                                variant={hasExported ? "default" : "outline"}
                                onClick={next}
                            >
                                {hasExported ? "Continue" : "Skip export"}
                            </Button>
                        </>
                    }
                >
                    <ExportStep
                        feedCount={regularFeeds.length}
                        folderCount={folderCount}
                        hasExported={hasExported}
                        onExport={handleExport}
                    />
                </DowngradeLayout>
            )
        case "keep":
            return (
                <DowngradeLayout
                    {...layoutProps}
                    wide
                    title={`Choose the ${feedLimit} you'll keep reading`}
                    subtitle={`The other ${Math.max(regularFeeds.length - feedLimit, 0)} will be unsubscribed. You can swap any of them later in Manage Feeds.`}
                    footer={
                        <>
                            {backButton}
                            <Button onClick={next} disabled={picked.size === 0}>
                                {picked.size === 0
                                    ? "Pick at least one"
                                    : `Keep ${picked.size} ${picked.size === 1 ? "feed" : "feeds"}`}
                            </Button>
                        </>
                    }
                >
                    <KeepFeedsStep
                        feeds={regularFeeds}
                        limit={feedLimit}
                        selected={picked}
                        onToggle={togglePick}
                    />
                </DowngradeLayout>
            )
        case "review":
            return (
                <DowngradeLayout
                    {...layoutProps}
                    title="Ready when you are"
                    subtitle={
                        hasExported
                            ? "Your export is saved, so nothing here is final. Import it any time to bring everything back."
                            : "You skipped the export. Go back a step if you want a copy before these feeds are removed."
                    }
                    footer={
                        <>
                            {backButton}
                            <Button
                                onClick={handleConfirm}
                                disabled={resolveDowngrade.isPending}
                            >
                                Continue on Free
                            </Button>
                        </>
                    }
                >
                    <ReviewStep
                        feedCount={regularFeeds.length}
                        keepCount={keepIds.size}
                        newsletterCount={newsletterCount}
                        savedCount={savedCount}
                    />
                </DowngradeLayout>
            )
    }
}
