import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { XCircle } from "lucide-react"
import Link from "next/link"

interface ErrorCardProps {
    message: string
}

export function ErrorCard({ message }: ErrorCardProps) {
    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-3">
                    <XCircle className="h-6 w-6 text-destructive" />
                    <CardTitle>Task Not Found</CardTitle>
                </div>
                <CardDescription className="text-destructive">
                    {message}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="text-sm text-muted-foreground">
                    <p>This can happen if:</p>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                        <li>The import was completed or failed long ago</li>
                        <li>The task data expired from temporary storage</li>
                        <li>There was a system restart</li>
                    </ul>
                </div>
                <div className="flex gap-3 pt-2">
                    <Button asChild className="flex-1">
                        <Link href="/import-opml">Start New Import</Link>
                    </Button>
                    <Button asChild variant="outline">
                        <Link href="/feeds">View Feeds</Link>
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}
