import { z } from "zod"

export const loginSchema = z.object({
    email: z.string().email("Please enter a valid email address"),
    password: z.string().min(1, "Password is required"),
})

export type LoginFormValues = z.infer<typeof loginSchema>

export const createSignUpSchema = (isCloudProd: boolean) => {
    const baseSchema = z.object({
        email: z.string().email("Please enter a valid email address"),
        username: z.string().min(3, "Username must be at least 3 characters"),
        password: z.string().min(6, "Password must be at least 6 characters"),
        confirmPassword: z.string(),
        acceptTerms: z.boolean().optional(),
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
