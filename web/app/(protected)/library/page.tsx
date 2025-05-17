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

interface LibraryErrorProps {
    message: string
}

function LibraryError({ message }: LibraryErrorProps) {
    return (
        <div className="text-center text-red-500">
            {message}
        </div>
    )
}

interface LibraryLayoutProps {
    children: React.ReactNode
}

function LibraryLayout({ children }: LibraryLayoutProps) {
    return (
        <div className="flex flex-col min-h-screen">
            <Header breadcrumbItems={[{ href: "/library", label: "Your Library" }]} />
            <main className="flex-1 container mx-auto px-4 py-8">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold">Your Library</h1>
                    <UploadBookDialog />
                </div>
                {children}
            </main>
        </div>
    )
}

export default async function Library() {
    try {
        const books = await ApiClient.books.getUserBooks() as UserBookLibrary[]
        
        return (
            <LibraryLayout>
                <LibraryCatalog books={books} />
            </LibraryLayout>
        )
    } catch (error) {
        if (error instanceof Error && error.message === "Authentication required") {
            redirect("/login")
        }

        return (
            <LibraryLayout>
                <LibraryError message="Failed to load books. Please try again later." />
            </LibraryLayout>
        )
    }
}
