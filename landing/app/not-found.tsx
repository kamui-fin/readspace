import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { AlertCircle } from "lucide-react"
import Head from "next/head"
import Link from "next/link"

export default function NotFound() {
    return (
        <>
            <Head>
                <title>Page Not Found</title>
            </Head>
            <div className="flex min-h-screen flex-col items-center justify-center">
                <Card className="w-full max-w-[400px] shadow-none border">
                    <CardHeader className="space-y-1 text-center">
                        <div className="flex justify-center mb-4">
                            <AlertCircle className="h-16 w-16 text-red-500" />
                        </div>
                        <CardTitle className="text-3xl font-bold tracking-tight">
                            404
                        </CardTitle>
                        <CardDescription className="text-xl">
                            Page Not Found
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="text-center text-foreground/80">
                        <p>
                            Oops! The page you&apos;re looking for doesn&apos;t
                            exist or has been moved.
                        </p>
                    </CardContent>
                    <CardFooter className="flex justify-center pb-6">
                        <Link href="/">
                            <Button size="lg">Back to Home</Button>
                        </Link>
                    </CardFooter>
                </Card>

                <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    <p>
                        Lost? Need help?{" "}
                        <Link
                            href="/contact"
                            className="font-medium text-primary hover:underline"
                        >
                            Contact us
                        </Link>
                    </p>
                </div>
            </div>
        </>
    )
}
