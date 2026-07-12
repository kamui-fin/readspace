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
import { cn } from "@/lib/utils"
import { MailIcon } from "lucide-react"
import * as React from "react"
import { z } from "zod"
import { signUp } from "@/app/(auth)/signup/actions"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
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
                <div className="text-center text-muted-foreground max-w-xs mb-6">
                    Please click on the link in the email we just sent you to
                    confirm your email address.
                </div>
                <a
                    href="/login"
                    className="text-sm font-semibold text-primary hover:text-primary/85 transition-colors underline underline-offset-4"
                >
                    Back to login
                </a>
            </CardContent>
        </Card>
    )
}

export function SignupForm({
    className,
    isProd = false,
    ...props
}: React.ComponentProps<"div"> & { isProd?: boolean }) {
    const [isAwaitingVerification, setIsAwaitingVerification] =
        React.useState(false)
    const router = useRouter()

    const showTerms = isProd
    const schema = React.useMemo(() => createSignUpSchema(showTerms), [showTerms])
    type SignUpFormValues = z.infer<typeof schema>

    const resolver = React.useCallback(
        async (values: SignUpFormValues) => {
            const result = await schema.safeParseAsync(values)
            if (result.success) {
                return { values: result.data, errors: {} }
            }

            const errors = result.error.issues.reduce((acc: any, issue) => {
                const fieldName = issue.path[0]
                if (fieldName) {
                    acc[fieldName] = {
                        type: issue.code,
                        message: issue.message,
                    }
                }
                return acc
            }, {})

            return { values: {}, errors }
        },
        [schema]
    )

    const form = useForm<SignUpFormValues>({
        resolver,
        mode: "onChange",
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
            const result = await signUp(values, showTerms)

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

                            {showTerms && (
                                <FormField
                                    control={form.control}
                                    name="acceptTerms"
                                    render={({ field }) => (
                                        <FormItem className="space-y-2">
                                            <div className="flex flex-row items-center space-x-2">
                                                <FormControl>
                                                    <Checkbox
                                                        checked={field.value}
                                                        onCheckedChange={
                                                            field.onChange
                                                        }
                                                        className="cursor-pointer"
                                                    />
                                                </FormControl>
                                                <FormLabel className="text-xs text-muted-foreground font-normal leading-tight cursor-pointer">
                                                    By clicking continue, you
                                                    agree to our{" "}
                                                    <a
                                                        href="https://readspace.ai/terms"
                                                        className="underline underline-offset-4 hover:text-primary transition-colors"
                                                    >
                                                        Terms of Service
                                                    </a>{" "}
                                                    and{" "}
                                                    <a
                                                        href="https://readspace.ai/privacy"
                                                        className="underline underline-offset-4 hover:text-primary transition-colors"
                                                    >
                                                        Privacy Policy
                                                    </a>
                                                    .
                                                </FormLabel>
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            )}

                            <Button
                                type="submit"
                                className="w-full"
                                disabled={
                                    form.formState.isSubmitting ||
                                    !form.formState.isValid
                                }
                            >
                                {form.formState.isSubmitting
                                    ? "Creating account..."
                                    : "Continue"}
                            </Button>

                            <div className="text-center text-sm">
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
