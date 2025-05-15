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
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "@/components/ui/sonner"
import { cn } from "@/lib/utils"
import { useFormik } from "formik"
import { MailIcon } from "lucide-react"
import * as React from "react"
import { z } from "zod"
import { toFormikValidationSchema } from "zod-formik-adapter"
import { signUp } from "../actions"

const signUpSchema = z
    .object({
        email: z.string().email(),
        username: z.string().min(3),
        password: z.string().min(6),
        confirmPassword: z.string(),
        acceptTerms: z.boolean().refine((val) => val === true, {
            message: "You must accept the terms and conditions",
        }),
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: "Passwords don't match",
        path: ["confirmPassword"],
    })

function VerificationNotice() {
    return (
        <Card className="bg-white">
            <CardContent className="flex flex-col items-center py-12">
                {/* Simple mail icon SVG */}
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

    const formik = useFormik({
        initialValues: {
            email: "",
            username: "",
            password: "",
            confirmPassword: "",
            acceptTerms: false,
        },
        validationSchema: toFormikValidationSchema(signUpSchema),
        onSubmit: async (values, { setTouched }) => {
            // Mark terms as touched to show validation error if not checked
            if (!values.acceptTerms) {
                setTouched({ ...formik.touched, acceptTerms: true })
            }
            try {
                const result = await signUp(values)

                if (result?.error) {
                    toast.error(result.error)
                    return
                }

                setIsAwaitingVerification(true)
            } catch (error) {
                toast.error("Something went wrong. Please try again.")
                console.error(error)
            }
        },
    })

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
                    <form onSubmit={formik.handleSubmit}>
                        <div className="grid gap-6">
                            <div className="grid gap-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="m@example.com"
                                    onChange={formik.handleChange}
                                    onBlur={formik.handleBlur}
                                    value={formik.values.email}
                                    required
                                    className={cn(
                                        formik.touched.email &&
                                            formik.errors.email
                                            ? "border-red-500 focus-visible:ring-red-500"
                                            : ""
                                    )}
                                />
                                {formik.touched.email &&
                                    formik.errors.email && (
                                        <p className="text-sm text-red-500">
                                            {formik.errors.email}
                                        </p>
                                    )}
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="username">Username</Label>
                                <Input
                                    id="username"
                                    type="text"
                                    placeholder="4-20 characters"
                                    onChange={formik.handleChange}
                                    onBlur={formik.handleBlur}
                                    value={formik.values.username}
                                    required
                                    className={cn(
                                        formik.touched.username &&
                                            formik.errors.username
                                            ? "border-red-500 focus-visible:ring-red-500"
                                            : ""
                                    )}
                                />
                                {formik.touched.username &&
                                    formik.errors.username && (
                                        <p className="text-sm text-red-500">
                                            {formik.errors.username}
                                        </p>
                                    )}
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="password">Password</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="at least 8 characters"
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
                            <div className="grid gap-2">
                                <Label htmlFor="confirmPassword">
                                    Confirm Password
                                </Label>
                                <Input
                                    id="confirmPassword"
                                    type="password"
                                    placeholder="retype your password"
                                    onChange={formik.handleChange}
                                    onBlur={formik.handleBlur}
                                    value={formik.values.confirmPassword}
                                    required
                                    className={cn(
                                        formik.touched.confirmPassword &&
                                            formik.errors.confirmPassword
                                            ? "border-red-500 focus-visible:ring-red-500"
                                            : ""
                                    )}
                                />
                                {formik.touched.confirmPassword &&
                                    formik.errors.confirmPassword && (
                                        <p className="text-sm text-red-500">
                                            {formik.errors.confirmPassword}
                                        </p>
                                    )}
                            </div>
                            <Button type="submit" className="w-full">
                                Continue
                            </Button>
                        </div>
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
                </CardContent>
            </Card>
            <div className="flex items-center justify-center space-x-2">
                <Checkbox
                    id="acceptTerms"
                    name="acceptTerms"
                    checked={formik.values.acceptTerms}
                    onCheckedChange={(checked) => {
                        formik.setFieldValue("acceptTerms", checked)
                    }}
                />
                <label
                    htmlFor="acceptTerms"
                    className="text-sm font-medium leading-none text-muted-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-60"
                >
                    By clicking continue, you agree to our{" "}
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
                </label>
            </div>
            {formik.touched.acceptTerms && formik.errors.acceptTerms && (
                <p className="text-sm text-red-500 text-start mt-2">
                    {formik.errors.acceptTerms}
                </p>
            )}
        </div>
    )
}
