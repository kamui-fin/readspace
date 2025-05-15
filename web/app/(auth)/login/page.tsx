import { LoginForm } from "@/app/(auth)/signup/auth/login-form"
import { createClient } from "@/lib/supabase/server"
import Image from "next/image"
import { redirect } from "next/navigation"

export const metadata = {
    title: "Log in | Readspace Beta",
}

export default async function LoginPage() {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (user) redirect("/")

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
                <LoginForm />
            </div>
        </div>
    )
}
