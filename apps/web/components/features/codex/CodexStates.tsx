"use client"

import {
    StarsIcon,
    MoonSleepIcon,
    RestartIcon,
    LockKeyholeIcon,
    DangerTriangleIcon,
    CloudCrossIcon,
} from "@solar-icons/react/bold"
import { Button } from "@/components/ui/button"
import { useUpgradeDialog } from "@/stores/upgrade-dialog"

interface ActionProps {
    onGenerate?: () => void
    isGenerating?: boolean
}

type Tone = "brand" | "neutral" | "danger"

const TONE: Record<Tone, { ring: string; icon: string }> = {
    brand: { ring: "bg-secondary/10", icon: "text-secondary" },
    neutral: { ring: "bg-muted", icon: "text-muted-foreground" },
    danger: { ring: "bg-destructive/10", icon: "text-destructive" },
}

function Shell({
    tone,
    icon: Icon,
    title,
    body,
    children,
}: {
    tone: Tone
    icon: React.ComponentType<{ className?: string }>
    title: string
    body: string
    children?: React.ReactNode
}) {
    const t = TONE[tone]
    return (
        <div className="flex min-h-[70vh] items-center justify-center px-4 py-16">
            <div className="flex w-full max-w-sm flex-col items-center text-center">
                <div
                    className={`flex size-11 items-center justify-center rounded-full ${t.ring}`}
                >
                    <Icon className={`size-[22px] ${t.icon}`} />
                </div>
                <h1 className="mt-5 text-lg font-bold tracking-tight text-foreground">
                    {title}
                </h1>
                <p className="mt-2 font-serif text-[15px] leading-relaxed text-muted-foreground">
                    {body}
                </p>
                {children && <div className="mt-6">{children}</div>}
            </div>
        </div>
    )
}

/** No digest has ever been requested. */
export function CodexEmptyState({ onGenerate, isGenerating }: ActionProps) {
    return (
        <Shell
            tone="brand"
            icon={StarsIcon}
            title="Your Daily Digest is ready to build"
            body="One synthesised read of the day's coverage — the developments worth knowing, strongest write-up first."
        >
            <Button onClick={onGenerate} disabled={isGenerating}>
                {isGenerating ? "Starting…" : "Build today's Digest"}
            </Button>
        </Shell>
    )
}

/** SKIPPED — zero candidate articles in the window. */
export function CodexQuietDayState({ onGenerate, isGenerating }: ActionProps) {
    return (
        <Shell
            tone="neutral"
            icon={MoonSleepIcon}
            title="A quiet 24 hours"
            body="Nothing new came through your sources, so there's no digest to build today."
        >
            {onGenerate && (
                <Button
                    variant="outline"
                    onClick={onGenerate}
                    disabled={isGenerating}
                >
                    <RestartIcon className="mr-2 size-4" />
                    Check again
                </Button>
            )}
        </Shell>
    )
}

/** FAILED generation, or a lost poll connection (`connectionLost`). Allowance not consumed. */
export function CodexFailedState({
    onGenerate,
    isGenerating,
    connectionLost = false,
}: ActionProps & { connectionLost?: boolean }) {
    if (connectionLost) {
        return (
            <Shell
                tone="neutral"
                icon={CloudCrossIcon}
                title="Lost the connection"
                body="We couldn't reach the server to check on your Daily Digest. Your place is saved — try again in a moment."
            >
                <Button
                    variant="outline"
                    onClick={onGenerate}
                    disabled={isGenerating}
                >
                    <RestartIcon className="mr-2 size-4" />
                    Retry
                </Button>
            </Shell>
        )
    }
    return (
        <Shell
            tone="danger"
            icon={DangerTriangleIcon}
            title="That didn't come together"
            body="Something broke mid-build. It didn't cost you any of your allowance."
        >
            <Button onClick={onGenerate} disabled={isGenerating}>
                <RestartIcon className="mr-2 size-4" />
                {isGenerating ? "Starting…" : "Try again"}
            </Button>
        </Shell>
    )
}

/**
 * Not-entitled 202 — the reason branches on `errorCode`: an exhausted monthly allowance
 * (a normal Basic occurrence — name the tier and point at Pro) vs. AI turned off on a
 * self-hosted instance (tell them it's a server-config switch).
 */
export function CodexNotEntitledState({
    reason,
    errorCode,
}: {
    reason: string
    errorCode: string
}) {
    if (errorCode === "AI_DISABLED") {
        return (
            <Shell
                tone="neutral"
                icon={LockKeyholeIcon}
                title="This Readspace runs without AI"
                body="The Daily Digest needs a model provider, and this instance was set up with AI features off."
            />
        )
    }

    // CODEX_LIMIT_EXCEEDED / SUBSCRIPTION_LIMIT_EXCEEDED / anything else metered.
    return (
        <Shell
            tone="neutral"
            icon={LockKeyholeIcon}
            title="You're out of Daily Digests this month"
            body={
                reason ||
                "Your monthly Daily Digest allowance is used up. It resets at the start of next month."
            }
        >
            <UpgradeButton />
        </Shell>
    )
}

function UpgradeButton() {
    const { open: openUpgrade } = useUpgradeDialog()
    return (
        <Button
            onClick={() =>
                openUpgrade({
                    title: "Upgrade to Readspace Pro",
                    description:
                        "Pro gives you a Daily Digest every day, plus unlimited AI interactions",
                })
            }
        >
            See Pro
        </Button>
    )
}
