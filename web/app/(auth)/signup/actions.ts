import { createClient } from "@/lib/supabase/client"
import { z } from "zod"

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

export async function signUp(formData: z.infer<typeof signUpSchema>) {
    try {
        const validatedData = signUpSchema.parse(formData)
        const supabase = await createClient()
        const { error } = await supabase.auth.signUp({
            email: validatedData.email,
            password: validatedData.password,
            options: {
                data: {
                    display_name: validatedData.username,
                },
                // Add new_user=true parameter to trigger onboarding after signup
                emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/library?new_user=true`,
            },
        })

        if (error) {
            return { error: error.message }
        }

        return { success: true }
    } catch (error) {
        console.error("Error signing up:", error)
        return { error: "Failed to sign up" }
    }
}
