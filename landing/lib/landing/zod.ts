import * as z from "zod"

export const contactSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Please enter a valid email address"),
    source: z.string().min(1, "Please select where you found us"),
    message: z.string().min(10, "Message must be at least 10 characters"),
})
