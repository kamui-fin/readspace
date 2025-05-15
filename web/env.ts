import { createEnv } from "@t3-oss/env-nextjs"
import { z } from "zod"

export const env = createEnv({
    /**
     * Specify your server-side environment variables schema here. This way you can ensure the app
     * isn't built with invalid env vars.
     */
    server: {
        DATABASE_URL: z.string().url(), // supabase db url
        NODE_ENV: z.enum(["development", "test", "production"]),
        PORT: z.coerce.number().optional(),
        VERCEL_URL: z.string().optional(), // Vercel provides this automatically
    },

    /**
     * Specify your client-side environment variables schema here. This way you can ensure the app
     * isn't built with invalid env vars. To expose them to the client, prefix them with
     * `NEXT_PUBLIC_`.
     */
    client: {
        NEXT_PUBLIC_NODE_ENV: z.enum(["development", "test", "production"]),
        NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
        NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string(),
        NEXT_PUBLIC_API_BASE_URL: z.string().url(),
        NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
        NEXT_PUBLIC_POSTHOG_HOST: z.string().url().optional(),
        NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID: z.string(),
        NEXT_PUBLIC_STRIPE_YEARLY_PRICE_ID: z.string(),
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
        NEXT_PUBLIC_NODE_ENV: process.env.NODE_ENV,
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY:
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
        NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
        NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
        NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID:
            process.env.NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID,
        NEXT_PUBLIC_STRIPE_YEARLY_PRICE_ID:
            process.env.NEXT_PUBLIC_STRIPE_YEARLY_PRICE_ID,
    },
})
