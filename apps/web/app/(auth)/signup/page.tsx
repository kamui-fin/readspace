import { Logo } from "@/components/ui/logo"
import { SignupForm } from "@/components/features/auth/SignupForm"
import { createClient } from "@/lib/supabase/server"
import Image from "next/image"
import { redirect } from "next/navigation"

export const metadata = {
    title: "Sign up | Readspace",
    description:
        "Create your free Readspace account and start your calm reading journey.",
}

export default async function SignupPage() {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (user) {
        redirect("/")
    }

    return (
        <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
            <div className="flex w-full max-w-sm flex-col gap-6">
                <a
                    href="#"
                    className="flex items-center gap-2 self-center font-medium font-logo text-black"
                >
                    <Logo />
                </a>
                <SignupForm />
            </div>
        </div>
    )
}
