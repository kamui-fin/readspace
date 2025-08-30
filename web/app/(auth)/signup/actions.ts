import { createClient } from "@/lib/supabase/client"
import { z } from "zod"

const createSignUpSchema = (isCloudProd: boolean) => {
    const baseSchema = z.object({
        email: z.string().email(),
        username: z.string().min(3),
        password: z.string().min(6),
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

export async function signUp(formData: any, isCloudProd: boolean = false) {
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
                    emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/`,
                }),
            },
        })
        console.log(error)

        if (error) {
            return { error: error.message }
        }

        return { success: true }
    } catch (error) {
        console.error("Error signing up:", error)
        return { error: "Failed to sign up" }
    }
}
