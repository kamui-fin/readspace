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
import { Label } from "@/components/ui/label"
import toast from "react-hot-toast"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { useFormik } from "formik"
import { useRouter } from "next/navigation"
import * as React from "react"
import z from "zod"
import { toFormikValidationSchema } from "zod-formik-adapter"
import { useIsCloudProd } from "@/hooks/use-is-cloud-prod"

const signInSchema = z.object({
    email: z.string().email("Please enter a valid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
})

type LoginFormBody = z.infer<typeof signInSchema>

export function LoginForm({
    className,
    ...props
}: React.ComponentProps<"div">) {
    const router = useRouter()
    const supabase = createClient()
    const isCloudProd = useIsCloudProd()

    const signInAction = async (values: LoginFormBody) => {
        const { error } = await supabase.auth.signInWithPassword({
            email: values.email,
            password: values.password,
        })

        if (error) {
            // Provide user-friendly error messages based on error codes
            let userFriendlyMessage: string
            switch (error.message) {
                case 'Invalid login credentials':
                    userFriendlyMessage = 'Invalid email or password. Please check your credentials and try again.'
                    break
                case 'Email not confirmed':
                    userFriendlyMessage = 'Please check your email and click the verification link before signing in.'
                    break
                case 'Too many requests':
                    userFriendlyMessage = 'Too many login attempts. Please wait a few minutes before trying again.'
                    break
                case 'User not found':
                    userFriendlyMessage = 'No account found with this email address. Please sign up first.'
                    break
                default:
                    userFriendlyMessage = error.message || 'Login failed. Please try again.'
            }

            toast.error(userFriendlyMessage)
            console.error("Login error:", error)
            return
        }

        toast.success("Successfully logged in!")
        router.push("/")
    }

    const handleGoogleSignIn = async () => {
        try {
            const { error, data } = await supabase.auth.signInWithOAuth({
                provider: "google",
                options: {
                    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/articles`,
                },
            })

            if (error) throw error
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Failed to login with Google. Please try again."

            // Provide specific error messages for Google OAuth
            if (errorMessage.includes('popup_closed_by_user')) {
                toast.error("Login cancelled. Please try again if you want to sign in with Google.")
            } else if (errorMessage.includes('access_denied')) {
                toast.error("Access denied. Please grant permission to continue with Google login.")
            } else {
                toast.error(errorMessage)
            }
            console.error("Google sign-in error:", error)
        }
    }

    const formik = useFormik({
        initialValues: {
            email: "",
            password: "",
        },
        validationSchema: toFormikValidationSchema(signInSchema),
        onSubmit: async (values) => {
            try {
                await signInAction(values)
            } catch (error: unknown) {
                // Handle any unexpected errors not caught by signInAction
                const errorMessage = error instanceof Error
                    ? error.message
                    : "An unexpected error occurred. Please try again."

                toast.error(errorMessage)
                console.error("Unexpected login error:", error)
            }
        },
    })

    return (
        <div className={cn("flex flex-col gap-6", className)} {...props}>
            <Card className="bg-white">
                <CardHeader className="text-center">
                    <CardTitle className="text-xl">Welcome back</CardTitle>
                    <CardDescription>
                        Login with your Google account
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={formik.handleSubmit}>
                        <div className="grid gap-6">
                            {isCloudProd && (
                                <>
                                    <div className="flex flex-col gap-4">
                                        <Button
                                            variant="outline"
                                            className="w-full"
                                            type="button"
                                            onClick={handleGoogleSignIn}
                                        >
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                viewBox="0 0 24 24"
                                                className="mr-2 h-4 w-4"
                                            >
                                                <path
                                                    d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                                                    fill="currentColor"
                                                />
                                            </svg>
                                            Login with Google
                                        </Button>
                                    </div>
                                    <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
                                        <span className="relative z-10 bg-background px-2 text-muted-foreground">
                                            Or continue with
                                        </span>
                                    </div>
                                </>
                            )}
                            <div className="grid gap-6">
                                <div className="grid gap-2">
                                    <Label htmlFor="email">Email</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="email@example.com"
                                        onChange={formik.handleChange}
                                        onBlur={formik.handleBlur}
                                        value={formik.values.email}
                                        required
                                        className={cn(
                                            formik.touched.email && formik.errors.email
                                                ? "border-red-500 focus-visible:ring-red-500"
                                                : ""
                                        )}
                                    />
                                    {formik.touched.email && formik.errors.email && (
                                        <p className="text-sm text-red-500">
                                            {formik.errors.email}
                                        </p>
                                    )}
                                </div>
                                <div className="grid gap-2">
                                    <div className="flex items-center">
                                        <Label htmlFor="password">
                                            Password
                                        </Label>
                                        {isCloudProd && (
                                            <a
                                                href="/login/reset"
                                                className="ml-auto text-sm underline-offset-4 hover:underline"
                                            >
                                                Forgot your password?
                                            </a>
                                        )}
                                    </div>
                                    <Input
                                        id="password"
                                        type="password"
                                        placeholder="********"
                                        onChange={formik.handleChange}
                                        onBlur={formik.handleBlur}
                                        value={formik.values.password}
                                        required
                                        className={cn(
                                            formik.touched.password &&
                                                formik.errors.password
                                                ? "border-red-500 focus-visible:ring-red-500"
                                                : ""
                                        )}
                                    />
                                    {formik.touched.password &&
                                        formik.errors.password && (
                                            <p className="text-sm text-red-500">
                                                {formik.errors.password}
                                            </p>
                                        )}
                                </div>
                                <Button type="submit" className="w-full">
                                    Continue
                                </Button>
                            </div>
                            <div className="text-center text-sm">
                                Don&apos;t have an account?{" "}
                                <a
                                    href="/signup"
                                    className="underline underline-offset-4"
                                >
                                    Sign up
                                </a>
                            </div>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
