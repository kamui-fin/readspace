"use client"

import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "react-hot-toast"

interface AppleIDSignInResponse {
    authorization: {
        id_token: string
        code: string
        state?: string
    }
    user?: {
        email?: string
        name?: {
            firstName?: string
            lastName?: string
        }
    }
}

declare global {
    interface Window {
        AppleID?: {
            auth: {
                init: (options: {
                    clientId: string
                    scope: string
                    redirectURI: string
                    usePopup: boolean
                    nonce: string
                }) => void
                signIn: () => Promise<AppleIDSignInResponse>
            }
        }
    }
}

interface AppleSignInButtonProps {
    className?: string
    text?: string
}

export function AppleSignInButton({
    className,
    text = "Login with Apple",
}: AppleSignInButtonProps) {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)

    const handleAppleSignIn = async () => {
        if (!window.AppleID) {
            toast.error(
                "Apple sign-in isn't ready yet. Please try again in a moment."
            )
            return
        }

        const servicesId = process.env.NEXT_PUBLIC_APPLE_SERVICES_ID
        if (!servicesId) {
            console.error(
                "NEXT_PUBLIC_APPLE_SERVICES_ID is not configured — Apple sign-in is unavailable."
            )
            toast.error("Apple sign-in is not configured for this instance.")
            return
        }

        setIsLoading(true)
        try {
            // A fresh nonce per attempt, re-initialized right before signIn() —
            // Supabase verifies this exact value against the identity token's
            // `nonce` claim, so it must match what was passed to init().
            const nonce = crypto.randomUUID()
            window.AppleID.auth.init({
                clientId: servicesId,
                scope: "name email",
                redirectURI: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
                usePopup: true,
                nonce,
            })

            const response = await window.AppleID.auth.signIn()

            const supabase = createClient()
            const { error } = await supabase.auth.signInWithIdToken({
                provider: "apple",
                token: response.authorization.id_token,
                nonce,
            })

            if (error) throw error

            // Apple only includes the user's name on the very first
            // authorization — every later sign-in omits it, so capture it now
            // or it's gone for good. (Never present for OAuth-redirect sign-ins,
            // only this popup JS flow.)
            if (response.user?.name) {
                const fullName = [
                    response.user.name.firstName,
                    response.user.name.lastName,
                ]
                    .filter(Boolean)
                    .join(" ")

                if (fullName) {
                    await supabase.auth.updateUser({
                        data: {
                            full_name: fullName,
                            given_name: response.user.name.firstName,
                            family_name: response.user.name.lastName,
                        },
                    })
                }
            }

            toast.success("Successfully logged in!")
            router.push("/")
        } catch (error) {
            const errorCode =
                error && typeof error === "object" && "error" in error
                    ? String((error as { error: unknown }).error)
                    : undefined

            if (
                errorCode === "popup_closed_by_user" ||
                errorCode === "user_cancelled"
            ) {
                // User closed the popup — no toast needed
            } else {
                const errorMessage =
                    error instanceof Error
                        ? error.message
                        : "Failed to login with Apple. Please try again."
                toast.error(errorMessage)
                console.error("Apple sign-in error:", error)
            }
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Button
            variant="outline"
            className={className}
            type="button"
            disabled={isLoading}
            onClick={handleAppleSignIn}
        >
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                className="mr-2 h-4 w-4"
            >
                <path
                    fill="currentColor"
                    d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.828-1.207.052-2.662.805-3.532 1.816-.78.895-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.56-1.702z"
                />
            </svg>
            {isLoading ? "Signing in…" : text}
        </Button>
    )
}
