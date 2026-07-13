import { createEnv } from "@t3-oss/env-nextjs"
import { z } from "zod"

export const env = createEnv({
    /**
     * Specify your server-side environment variables schema here. This way you can ensure the app
     * isn't built with invalid env vars.
     */
    server: {
        NODE_ENV: z
            .enum(["development", "test", "production"])
            .default("development"),
        SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
        POLAR_ACCESS_TOKEN: z.string().optional(),
        POLAR_WEBHOOK_SECRET: z.string().optional(),
        REVENUECAT_WEBHOOK_SECRET: z.string().optional(),
    },

    /**
     * Specify your client-side environment variables schema here. This way you can ensure the app
     * isn't built with invalid env vars. To expose them to the client, prefix them with
     * `NEXT_PUBLIC_`.
     */
    client: {
        NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
        NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string(),
        NEXT_PUBLIC_API_BASE_URL: z
            .string()
            .url()
            .default("http://localhost:8008"),
        NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:8042"),
        NEXT_PUBLIC_POLAR_CHECKOUT_URL: z.string().url().optional(),
        NEXT_PUBLIC_POLAR_MONTHLY_PRODUCT_ID: z.string().optional(),
        NEXT_PUBLIC_POLAR_YEARLY_PRODUCT_ID: z.string().optional(),
    },

    /**
     * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation.
     * This is especially useful for Docker builds.
     */
    skipValidation: !!process.env.SKIP_ENV_VALIDATION,

    /**
     * Specify the runtime environment variables that will be available to the client.
     * This is required by @t3-oss/env-nextjs.
     */
    experimental__runtimeEnv: {
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY:
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
        NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
        NEXT_PUBLIC_POLAR_CHECKOUT_URL:
            process.env.NEXT_PUBLIC_POLAR_CHECKOUT_URL,
        NEXT_PUBLIC_POLAR_MONTHLY_PRODUCT_ID:
            process.env.NEXT_PUBLIC_POLAR_MONTHLY_PRODUCT_ID,
        NEXT_PUBLIC_POLAR_YEARLY_PRODUCT_ID:
            process.env.NEXT_PUBLIC_POLAR_YEARLY_PRODUCT_ID,
    },
})
