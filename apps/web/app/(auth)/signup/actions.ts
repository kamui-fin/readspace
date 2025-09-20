import { createClient } from "@/lib/supabase/client"
import { z } from "zod"

const createSignUpSchema = (isCloudProd: boolean) => {
    const baseSchema = z.object({
        email: z.string().email("Please enter a valid email address"),
        username: z.string().min(3, "Username must be at least 3 characters"),
        password: z.string().min(6, "Password must be at least 6 characters"),
        confirmPassword: z.string(),
    })

    const cloudSchema = baseSchema.extend({
        acceptTerms: z.boolean().refine((val) => val === true, {
            message: "You must accept the terms and conditions",
        }),
    })

    const schema = isCloudProd ? cloudSchema : baseSchema

    return schema.refine((data) => data.password === data.confirmPassword, {
        message: "Passwords don't match",
        path: ["confirmPassword"],
    })
}

export async function signUp(
    formData: Record<string, unknown>,
    isCloudProd: boolean = false
) {
    try {
        const signUpSchema = createSignUpSchema(isCloudProd)
        const validatedData = signUpSchema.parse(formData)
        const supabase = createClient()
        const { error } = await supabase.auth.signUp({
            email: validatedData.email,
            password: validatedData.password,
            options: {
                data: {
                    display_name: validatedData.username,
                },
                ...(isCloudProd && {
                    emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/onboarding`,
                }),
            },
        })
        console.log(error)

        if (error) {
            // Provide user-friendly error messages based on error codes
            switch (error.message) {
                case "User already registered":
                    return {
                        error: "An account with this email already exists. Please try logging in instead.",
                    }
                case "Password should be at least 6 characters":
                    return {
                        error: "Password must be at least 6 characters long.",
                    }
                case "Invalid email":
                    return { error: "Please enter a valid email address." }
                case "Signup is disabled":
                    return {
                        error: "Account registration is currently disabled. Please contact support.",
                    }
                case "Email rate limit exceeded":
                    return {
                        error: "Too many signup attempts. Please wait a few minutes before trying again.",
                    }
                default:
                    return {
                        error:
                            error.message ||
                            "Failed to create account. Please try again.",
                    }
            }
        }

        return { success: true }
    } catch (error) {
        console.error("Error signing up:", error)

        if (error instanceof z.ZodError) {
            // Handle validation errors
            const firstError = error.errors[0]
            return { error: firstError?.message || "Validation error occurred" }
        }

        return {
            error: "An unexpected error occurred during signup. Please try again.",
        }
    }
}
