"use client"

import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { toast } from "react-hot-toast"

interface GoogleSignInButtonProps {
    className?: string
    text?: string
}

export function GoogleSignInButton({
    className,
    text = "Login with Google",
}: GoogleSignInButtonProps) {
    const handleGoogleSignIn = async () => {
        const supabase = createClient()
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: "google",
                options: {
                    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
                },
            })

            if (error) throw error
        } catch (error) {
            const errorMessage =
                error instanceof Error
                    ? error.message
                    : "Failed to login with Google. Please try again."

            if (errorMessage.includes("popup_closed_by_user")) {
                toast.error(
                    "Login cancelled. Please try again if you want to sign in with Google."
                )
            } else if (errorMessage.includes("access_denied")) {
                toast.error(
                    "Access denied. Please grant permission to continue with Google login."
                )
            } else {
                toast.error(errorMessage)
            }
            console.error("Google sign-in error:", error)
        }
    }

    return (
        <Button
            variant="outline"
            className={className}
            type="button"
            onClick={handleGoogleSignIn}
        >
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                className="mr-2 h-4 w-4"
            >
                <path
                    d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                    fill="currentColor"
                />
            </svg>
            {text}
        </Button>
    )
}
