"use client"

import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import toast from "react-hot-toast"
import { cn } from "@readspace/shared"
import { MailIcon } from "lucide-react"
import * as React from "react"
import { z } from "zod"
import { signUp } from "@/app/(auth)/signup/actions"
import { isCloudProd } from "@/lib/is-cloud-prod"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { createSignUpSchema } from "./lib/schemas"

function VerificationNotice() {
    return (
        <Card className="bg-white">
            <CardContent className="flex flex-col items-center py-12">
                <MailIcon className="w-12 h-12 mb-6 text-primary" />

                <div className="text-xl font-medium mb-2">
                    Verify your email address
                </div>
                <div className="text-center text-muted-foreground max-w-xs">
                    Please click on the link in the email we just sent you to
                    confirm your email address.
                </div>
            </CardContent>
        </Card>
    )
}

export function SignupForm({
    className,
    ...props
}: React.ComponentProps<"div">) {
    const [isAwaitingVerification, setIsAwaitingVerification] =
        React.useState(false)
    const [isLoading, setIsLoading] = React.useState(false)
    const [isGoogleLoading, setIsGoogleLoading] = React.useState(false)
    const isProd = isCloudProd()
    const router = useRouter()

    const schema = createSignUpSchema(isProd)
    type SignUpFormValues = z.infer<typeof schema>

    const form = useForm<SignUpFormValues>({
        // @ts-ignore
        resolver: zodResolver(schema),
        defaultValues: {
            email: "",
            username: "",
            password: "",
            confirmPassword: "",
            acceptTerms: false,
        },
    })

    const onSubmit = async (values: SignUpFormValues) => {
        try {
            const result = await signUp(values, isProd)

            if (result?.error) {
                toast.error(result.error)
                return
            }

            if (isProd) {
                setIsAwaitingVerification(true)
            } else {
                router.push("/")
            }
        } catch (error) {
            const errorMessage =
                error instanceof Error
                    ? error.message
                    : "An unexpected error occurred. Please try again."

            toast.error(errorMessage)
            console.error("Signup error:", error)
        }
    }

    if (isAwaitingVerification) {
        return <VerificationNotice />
    }

    return (
        <div className={cn("flex flex-col gap-6", className)} {...props}>
            <Card className="bg-white">
                <CardHeader className="text-center">
                    <CardTitle className="text-xl">Get Started</CardTitle>
                    <CardDescription>
                        Create your Readspace Account
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form
                            onSubmit={form.handleSubmit(onSubmit)}
                            className="grid gap-6"
                        >
                            <FormField
                                control={form.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Email</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="m@example.com"
                                                type="email"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="username"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Username</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="4-20 characters"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="password"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Password</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="password"
                                                placeholder="at least 6 characters"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="confirmPassword"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Confirm Password</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="password"
                                                placeholder="retype your password"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {isProd && (
                                <FormField
                                    control={form.control}
                                    name="acceptTerms"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md p-4">
                                            <FormControl>
                                                <Checkbox
                                                    checked={field.value}
                                                    onCheckedChange={
                                                        field.onChange
                                                    }
                                                />
                                            </FormControl>
                                            <div className="space-y-1 leading-none">
                                                <FormLabel>
                                                    By clicking continue, you
                                                    agree to our{" "}
                                                    <a
                                                        href="https://readspace.ai/terms"
                                                        className="underline underline-offset-4"
                                                    >
                                                        Terms of Service
                                                    </a>{" "}
                                                    and{" "}
                                                    <a
                                                        href="https://readspace.ai/privacy"
                                                        className="underline underline-offset-4"
                                                    >
                                                        Privacy Policy
                                                    </a>
                                                    .
                                                </FormLabel>
                                                <FormMessage />
                                            </div>
                                        </FormItem>
                                    )}
                                />
                            )}

                            <Button
                                type="submit"
                                className="w-full"
                                disabled={form.formState.isSubmitting}
                            >
                                {form.formState.isSubmitting
                                    ? "Creating account..."
                                    : "Continue"}
                            </Button>

                            <div className="text-center text-sm pt-6">
                                Already have an account?{" "}
                                <a
                                    href="/login"
                                    className="underline underline-offset-4"
                                >
                                    Login
                                </a>
                            </div>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </div>
    )
}
