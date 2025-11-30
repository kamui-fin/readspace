"use client"

import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { ArrowLeft, RefreshCw, WifiOff } from "lucide-react"

export default function OfflinePage() {
    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                        <WifiOff className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <CardTitle>You&apos;re offline</CardTitle>
                    <CardDescription>
                        It looks like you&apos;ve lost your internet connection.
                        Some features may not be available until you&apos;re
                        back online.
                    </CardDescription>
                </CardHeader>
                <CardContent className="text-center space-y-4">
                    <p className="text-sm text-muted-foreground">
                        Your previously loaded articles are still available to
                        read.
                    </p>
                    <Button
                        onClick={() => window.location.reload()}
                        className="w-full"
                        variant="outline"
                    >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Try again
                    </Button>
                    <Button
                        onClick={() => window.history.back()}
                        className="w-full"
                    >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Go back
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}
