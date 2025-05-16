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
import { cn } from "@/lib/utils"
import { useFormik } from "formik"
import * as React from "react"
import toast from "react-hot-toast"
import { z } from "zod"
import { toFormikValidationSchema } from "zod-formik-adapter"
import { signUp } from "./actions"

const signUpSchema = z
    .object({
        email: z.string().email(),
        username: z.string().min(3),
        password: z.string().min(6),
        confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: "Passwords don't match",
        path: ["confirmPassword"],
    })

export function SignupForm({
    className,
    ...props
}: React.ComponentProps<"div">) {
    const formik = useFormik({
        initialValues: {
            email: "",
            username: "",
            password: "",
            confirmPassword: "",
        },
        validationSchema: toFormikValidationSchema(signUpSchema),
        onSubmit: async (values) => {
            try {
                const result = await signUp(values)

                if (result?.error) {
                    toast.error(result.error)
                    return
                }

                // Redirect to login page on successful signup
                window.location.href = "/login"
            } catch (error) {
                toast.error("Something went wrong. Please try again.")
                console.error(error)
            }
        },
    })

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
        </div>
    )
}
