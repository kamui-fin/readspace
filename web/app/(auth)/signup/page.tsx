import { SignupForm } from "@/app/(auth)/signup/signup-form"
import { createClient } from "@/lib/supabase/server"
import Image from "next/image"
import { redirect } from "next/navigation"

export const metadata = {
    title: "Sign up | Readspace Beta",
    description: "Create your free Readspace account.",
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
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
                        <Image
                            src="/readspace.svg"
                            width={24}
                            height={24}
                            alt="Logo"
                        />
                    </div>
                    Readspace
                </a>
                <SignupForm />
            </div>
        </div>
    )
}
