import { object, string } from "zod"

export const signInSchema = object({
    username: string({ required_error: "Username is required" })
        .min(4, "Username must be at least 4 characters")
        .max(20, "Username must be less than 20 characters")
        .regex(
            /^[a-zA-Z0-9_-]+$/,
            "Username can only contain letters, numbers, underscores, and hyphens"
        ),
    password: string({ required_error: "Password is required" })
        .min(1, "Password is required")
        .min(8, "Password must be more than 8 characters")
        .max(32, "Password must be less than 32 characters"),
})

export const signUpSchema = object({
    email: string({ required_error: "Email is required" })
        .min(1, "Email is required")
        .email("Invalid email"),
    username: string({ required_error: "Username is required" })
        .min(4, "Username must be at least 4 characters")
        .max(20, "Username must be less than 20 characters")
        .regex(
            /^[a-zA-Z0-9_-]+$/,
            "Username can only contain letters, numbers, underscores, and hyphens"
        ),
    password: string({ required_error: "Password is required" })
        .min(1, "Password is required")
        .min(8, "Password must be more than 8 characters")
        .max(32, "Password must be less than 32 characters"),
    confirmPassword: string({ required_error: "Confirm password is required" })
        .min(1, "Confirm password is required")
        .min(8, "Confirm password must be more than 8 characters")
        .max(32, "Confirm password must be less than 32 characters"),
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords must match",
    path: ["confirmPassword"],
})
