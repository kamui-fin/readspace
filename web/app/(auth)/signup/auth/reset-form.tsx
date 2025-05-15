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

const resetSchema = z.object({
    email: z.string().email("Please enter a valid email address"),
})

type ResetFormBody = z.infer<typeof resetSchema>

export function ResetForm({
    className,
    ...props
}: React.ComponentProps<"div">) {
    const router = useRouter()
    const supabase = createClient()

    const resetAction = async (values: ResetFormBody) => {
        const { error } = await supabase.auth.resetPasswordForEmail(
            values.email,
            {
                redirectTo: `${window.location.origin}/auth/callback?next=/login/update-password`,
            }
        )

        if (error) throw error
        return true
    }

    const formik = useFormik({
        initialValues: {
            email: "",
        },
        validationSchema: toFormikValidationSchema(resetSchema),
        onSubmit: async (values) => {
            try {
                await resetAction(values)
                toast.success("Password reset link sent! Check your email.")
                setTimeout(() => {
                    router.push("/login")
                }, 2000)
            } catch (error: unknown) {
                toast.error(
                    error instanceof Error
                        ? error.message
                        : "Failed to send reset link. Please try again."
                )
                console.error(error)
            }
        },
    })

    return (
        <div className={cn("flex flex-col gap-6", className)} {...props}>
            <Card className="bg-white">
                <CardHeader className="text-center">
                    <CardTitle className="text-xl">Reset Password</CardTitle>
                    <CardDescription>
                        Enter your email to receive a reset link
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={formik.handleSubmit}>
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
                                />
                                {formik.touched.email &&
                                    formik.errors.email && (
                                        <p className="text-sm text-red-500">
                                            {formik.errors.email}
                                        </p>
                                    )}
                            </div>
                            <Button type="submit" className="w-full">
                                Send Reset Link
                            </Button>
                            <div className="text-center text-sm">
                                Remember your password?{" "}
                                <a
                                    href="/login"
                                    className="underline underline-offset-4"
                                >
                                    Sign in
                                </a>
                            </div>
                        </div>
                    </form>
                </CardContent>
            </Card>
            <div className="text-balance text-center text-xs text-muted-foreground [&_a]:underline [&_a]:underline-offset-4 [&_a]:hover:text-primary">
                By clicking continue, you agree to our{" "}
                <a href="https://readspace.ai/terms">Terms of Service</a> and{" "}
                <a href="https://readspace.ai/privacy">Privacy Policy</a>.
            </div>
        </div>
    )
}
