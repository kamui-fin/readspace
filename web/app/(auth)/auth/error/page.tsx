import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { AlertCircle } from "lucide-react"
import Link from "next/link"

export default function AuthError() {
    return (
        <div className="flex min-h-screen items-center justify-center">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                        <AlertCircle className="h-6 w-6 text-red-600" />
                    </div>
                    <CardTitle className="text-xl">Authentication Error</CardTitle>
                    <CardDescription>
                        Something went wrong during the authentication process.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="text-center text-sm text-muted-foreground">
                        This could be due to an expired link, invalid credentials, or a technical issue.
                    </div>
                    <div className="flex flex-col gap-2">
                        <Button asChild>
                            <Link href="/login">Try Again</Link>
                        </Button>
                        <Button variant="outline" asChild>
                            <Link href="/signup">Create Account</Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}