import Header from "@/components/navigation/header"

import { LibraryCatalog } from "@/components/library/library-catalog"
import UploadBookDialog from "@/components/library/upload-book"
import { getBooks } from "@/lib/db/supabase"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { BookMeta } from "../../../types/library"

export const metadata = {
    title: "Library | Readspace Beta",
    description: "Browse and manage your uploaded books and documents.",
}

export default async function Library() {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        ;("no user for library, redirecting to login")
        redirect("/login")
    }

    const books = await getBooks(user.id)

    return (
        <div className="flex flex-col min-h-screen">
            <Header
                breadcrumbItems={[{ href: "/library", label: "My Library" }]}
            />
            <main className="flex-1">
                <div className="container mx-auto px-6 py-6">
                    <div className="flex justify-between items-center mb-8">
                        <h1 className="text-3xl font-bold">My Library</h1>
                        <UploadBookDialog />
                    </div>
                    <LibraryCatalog books={books as BookMeta[]} />
                </div>
            </main>
        </div>
    )
}
