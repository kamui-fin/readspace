import { LibraryCatalog } from "@/components/library/library-catalog"
import UploadBookDialog from "@/components/library/upload-book"
import Header from "@/components/navigation/header"
import { ApiClient } from "@/lib/api/client"
import { createClient } from "@/lib/supabase/server"
import { UserBookLibrary } from "@/types/api"
import { redirect } from "next/navigation"

export const metadata = {
    title: "Library | ReadSpace",
    description: "Your personal library of books",
}

export default async function Library() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect("/login")
    }

    try {
        const books = (await ApiClient.books.getUserBooks()) as UserBookLibrary[]
        console.log(books)
        return (
            <div className="flex flex-col min-h-screen">
                <Header breadcrumbItems={[{ href: "/library", label: "Your Library" }]} />
                <main className="flex-1 container mx-auto px-4 py-8">
                    <div className="flex justify-between items-center mb-8">
                        <h1 className="text-3xl font-bold">Your Library</h1>
                        <UploadBookDialog />
                    </div>
                    <LibraryCatalog books={books} />
                </main>
            </div>
        )
    } catch (error) {
        console.error("Failed to fetch books:", error)

        // If authentication error, redirect to login
        if (error instanceof Error && error.message === "Authentication required") {
            redirect("/login")
        }

        return (
            <div className="flex flex-col min-h-screen">
                <Header breadcrumbItems={[{ href: "/library", label: "Your Library" }]} />
                <main className="flex-1 container mx-auto px-4 py-8">
                    <div className="flex justify-between items-center mb-8">
                        <h1 className="text-3xl font-bold">Your Library</h1>
                        <UploadBookDialog />
                    </div>
                    <div className="text-center text-red-500">
                        Failed to load books. Please try again later.
                    </div>
                </main>
            </div>
        )
    }
}
