"use client"

import { useEffect, useState } from "react"
import { ApiClient } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { toast } from "react-hot-toast"
import { Mail, Copy, Check, RefreshCw, Info, Sparkles } from "lucide-react"

export function NewsletterSection() {
    // Token & Email state
    const [tokenData, setTokenData] = useState<{ token: string; email: string } | null>(null)
    const [isTokenLoading, setIsTokenLoading] = useState(true)
    const [isTokenRefreshing, setIsTokenRefreshing] = useState(false)
    const [copied, setCopied] = useState(false)

    // Fetch token on mount
    useEffect(() => {
        fetchToken()
    }, [])

    const fetchToken = async (refresh = false) => {
        if (refresh) {
            setIsTokenRefreshing(true)
        } else {
            setIsTokenLoading(true)
        }

        try {
            const response = await ApiClient.getNewsletterToken()
            setTokenData(response)
        } catch (error) {
            console.error("Failed to fetch newsletter token:", error)
            toast.error("Failed to load your personal newsletter email.")
        } finally {
            setIsTokenLoading(false)
            setIsTokenRefreshing(false)
        }
    }

    const copyToClipboard = () => {
        if (!tokenData?.email) return
        navigator.clipboard.writeText(tokenData.email)
        setCopied(true)
        toast.success("Copied to clipboard!")
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <div className="space-y-6 max-w-2xl mx-auto mt-8">
            {/* Main Email Inbound Card */}
            <Card className="border-border/60 bg-card/40 backdrop-blur-sm shadow-md overflow-hidden relative">
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                    <Mail className="w-32 h-32 rotate-12" />
                </div>
                <CardHeader>
                    <div className="flex items-center gap-2 text-primary mb-1">
                        <Sparkles className="w-4 h-4" />
                        <span className="text-xs font-semibold uppercase tracking-wider">New Feature</span>
                    </div>
                    <CardTitle className="flex items-center gap-2 text-2xl font-bold tracking-tight">
                        📬 Newsletter Ingestion
                    </CardTitle>
                    <CardDescription className="text-sm text-muted-foreground max-w-lg">
                        Ditch the clogged email inbox. Subscribe to Substack, Mailchimp, or any mailing list directly within Readspace using your private email alias.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Inbound Address Box */}
                    <div className="space-y-2">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Your Personal Newsletter Address
                        </Label>
                        <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                                {isTokenLoading ? (
                                    <div className="h-10 w-full rounded-md border border-input bg-muted/40 animate-pulse flex items-center px-3 text-sm text-muted-foreground">
                                        Generating private email address...
                                    </div>
                                ) : (
                                    <input
                                        type="text"
                                        readOnly
                                        value={tokenData?.email || ""}
                                        className="h-10 w-full rounded-md border border-input bg-muted/20 px-3 py-2 text-sm font-mono focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring pr-10 truncate cursor-text"
                                        onClick={(e) => (e.target as HTMLInputElement).select()}
                                    />
                                )}
                            </div>

                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={copyToClipboard}
                                disabled={isTokenLoading || !tokenData}
                                className="shrink-0 h-10 w-10 hover:bg-muted/50"
                                title="Copy to clipboard"
                            >
                                {copied ? (
                                    <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                                ) : (
                                    <Copy className="h-4 w-4" />
                                )}
                            </Button>

                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => fetchToken(true)}
                                disabled={isTokenLoading || isTokenRefreshing}
                                className="shrink-0 h-10 w-10 hover:bg-muted/50"
                                title="Refresh Address"
                            >
                                <RefreshCw className={`h-4 w-4 ${isTokenRefreshing ? 'animate-spin' : ''}`} />
                            </Button>
                        </div>
                    </div>

                    {/* How it works info */}
                    <div className="rounded-lg bg-muted/30 border border-border/30 p-3.5 flex gap-3 text-xs leading-relaxed text-muted-foreground">
                        <Info className="w-4 h-4 shrink-0 text-primary/80 mt-0.5" />
                        <div>
                            <strong>How to use:</strong> Paste this email alias when subscribing to any newsletter. The first email received will automatically register the newsletter in your <strong>Newsletters</strong> folder.
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
