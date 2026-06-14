"use client"

import { useEffect, useState } from "react"
import { ApiClient } from "@/lib/api-client"
import { toast } from "react-hot-toast"
import { MailOpen, Copy, Check } from "lucide-react"
import { useUserRole } from "@/hooks/use-user-role"
import { useUpgradeDialog } from "@/stores/upgrade-dialog"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from "@/components/ui/dialog"

export function NewsletterSection() {
    const { isBasic } = useUserRole()
    const { open: openUpgrade } = useUpgradeDialog()
    const [isOpen, setIsOpen] = useState(false)
    const [tokenData, setTokenData] = useState<{ token: string; email: string } | null>(null)
    const [isTokenLoading, setIsTokenLoading] = useState(false)
    const [copied, setCopied] = useState(false)

    // Fetch token when modal opens (and only if the user is not basic)
    useEffect(() => {
        if (isOpen && !isBasic && !tokenData) {
            fetchToken()
        }
    }, [isOpen, isBasic, tokenData])

    const fetchToken = async () => {
        setIsTokenLoading(true)
        try {
            const response = await ApiClient.getNewsletterToken()
            setTokenData(response)
        } catch (error) {
            console.error("Failed to fetch newsletter token:", error)
            toast.error("Failed to load your personal newsletter email.")
        } finally {
            setIsTokenLoading(false)
        }
    }

    const copyToClipboard = () => {
        if (!tokenData?.email) return
        navigator.clipboard.writeText(tokenData.email)
        setCopied(true)
        toast.success("Copied to clipboard!")
        setTimeout(() => setCopied(false), 2000)
    }

    const handleTriggerClick = () => {
        if (isBasic) {
            openUpgrade({
                title: "Upgrade to Readspace Pro",
                description: "Unlock newsletter ingestion and subscribe to Substack, Mailchimp, or any mailing list directly in your feed.",
            })
        } else {
            setIsOpen(true)
        }
    }

    return (
        <>
            {/* Minimalist text link trigger */}
            <button
                onClick={handleTriggerClick}
                className="mt-6 text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2 cursor-pointer group font-medium"
            >
                <MailOpen className="w-3.5 h-3.5" />
                <span>Subscribe to newsletters via email</span>
                <span className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
            </button>

            {/* Modal only for premium users */}
            {!isBasic && (
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogContent className="w-full max-w-md p-6 bg-background border-border rounded-lg shadow-lg">
                        <div className="flex flex-col space-y-5">
                            <div className="space-y-1">
                                <DialogTitle className="text-lg font-semibold tracking-tight text-foreground">
                                    Newsletter Ingestion
                                </DialogTitle>
                                <DialogDescription className="text-sm text-muted-foreground">
                                    Subscribe to mailing lists directly using your private email alias.
                                </DialogDescription>
                            </div>

                            <div className="space-y-6 pt-2">
                                {/* Step 1 */}
                                <div className="flex gap-4">
                                    <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                                        1
                                    </div>
                                    <div className="space-y-2 flex-1 min-w-0">
                                        <span className="text-sm font-medium text-foreground">
                                            Copy your private email address
                                        </span>
                                        <div className="flex items-center justify-between gap-3 mt-2 p-2 px-2.5 bg-muted/40 border border-border/40 rounded-lg font-mono text-xs max-w-full overflow-hidden">
                                            {isTokenLoading ? (
                                                <span className="text-muted-foreground animate-pulse">Generating address...</span>
                                            ) : (
                                                <span className="truncate flex-1 select-all text-foreground font-semibold">{tokenData?.email || ""}</span>
                                            )}
                                            <button
                                                onClick={copyToClipboard}
                                                disabled={isTokenLoading || !tokenData}
                                                className="text-muted-foreground hover:text-foreground transition-colors p-1.5 hover:bg-muted rounded-md cursor-pointer shrink-0 disabled:opacity-50"
                                                title="Copy email alias"
                                            >
                                                {copied ? (
                                                    <Check className="w-4 h-4 text-secondary dark:text-secondary" />
                                                ) : (
                                                    <Copy className="w-4 h-4" />
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Step 2 */}
                                <div className="flex gap-4">
                                    <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                                        2
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-sm font-medium text-foreground">
                                            Subscribe on any website
                                        </span>
                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                            Paste this private email address in the subscription form of Substack, Mailchimp, or any other publication.
                                        </p>
                                    </div>
                                </div>

                                {/* Step 3 */}
                                <div className="flex gap-4">
                                    <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                                        3
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-sm font-medium text-foreground">
                                            Read in Readspace
                                        </span>
                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                            The first email received will automatically create the feed and place it in your <strong className="text-primary font-semibold">Newsletters</strong> folder.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </>
    )
}
