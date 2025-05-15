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
import { toast } from "@/components/ui/sonner"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { useFormik } from "formik"
import { useRouter } from "next/navigation"
import * as React from "react"
import z from "zod"
import { toFormikValidationSchema } from "zod-formik-adapter"

const signInSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
})

type LoginFormBody = z.infer<typeof signInSchema>

export function LoginForm({
    className,
    ...props
}: React.ComponentProps<"div">) {
    const router = useRouter()
    const supabase = createClient()

    const signInAction = async (values: LoginFormBody) => {
        const { error } = await supabase.auth.signInWithPassword({
            email: values.email,
            password: values.password,
        })

        if (error) throw error
        router.push("/library")
    }

    const handleGoogleSignIn = async () => {
        try {
            const { error, data } = await supabase.auth.signInWithOAuth({
                provider: "google",
                options: {
                    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/library`,
                },
            })

            if (error) throw error
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Failed to login with Google. Please try again."
            )
            console.error(error)
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
                toast.success("Successfully logged in!")
            } catch (error: unknown) {
                toast.error(
                    error instanceof Error
                        ? error.message
                        : "Failed to login. Please try again."
                )
                console.error(error)
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
                                        // className={cn(
                                        //     formik.touched.email && formik.errors.email
                                        //         ? "border-red-500 focus-visible:ring-red-500"
                                        //         : ""
                                        // )}
                                    />
                                    {/* {formik.touched.email && formik.errors.email && (
                                        <p className="text-sm text-red-500">
                                            {formik.errors.email}
                                        </p>
                                    )} */}
                                </div>
                                <div className="grid gap-2">
                                    <div className="flex items-center">
                                        <Label htmlFor="password">
                                            Password
                                        </Label>
                                        {/* <a
                                            href="/login/reset"
                                            className="ml-auto text-sm underline-offset-4 hover:underline"
                                        >
                                            Forgot your password?
                                        </a> */}
                                    </div>
                                    <Input
                                        id="password"
                                        type="password"
                                        placeholder="********"
                                        onChange={formik.handleChange}
                                        onBlur={formik.handleBlur}
                                        value={formik.values.password}
                                        required
                                        // className={cn(
                                        //     formik.touched.password &&
                                        //         formik.errors.password
                                        //         ? "border-red-500 focus-visible:ring-red-500"
                                        //         : ""
                                        // )}
                                    />
                                    {/* {formik.touched.password &&
                                        formik.errors.password && (
                                            <p className="text-sm text-red-500">
                                                {formik.errors.password}
                                            </p>
                                        )} */}
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
