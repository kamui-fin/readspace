"use server"

import { sanitizeJsonRecursively } from "@/components/library/upload/utils"
import { Tables, TablesInsert, TablesUpdate } from "@/database.types"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

// Book operations
export async function getBooks(userId: string): Promise<Tables<"books">[]> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from("books")
        .select("*")
        .eq("user_id", userId)
        .order("date_added", { ascending: false })

    if (error) {
        console.error("Error fetching books:", error)
        return []
    }

    return data || []
}

export async function getBook(id: string): Promise<Tables<"books"> | null> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from("books")
        .select("*")
        .eq("id", id)
        .single()

    if (error) {
        console.error("Error fetching book:", error)
        return null
    }

    return data
}

export async function addBook(
    book: TablesInsert<"books">
): Promise<Tables<"books"> | null> {
    const supabase = await createClient()

    // Sanitize all book data to remove null bytes
    const sanitizedBook = sanitizeJsonRecursively(book) as TablesInsert<"books">

    const { data, error } = await supabase
        .from("books")
        .insert(sanitizedBook)
        .select()
        .single()

    if (error) {
        console.error("Error adding book:", error)
        return null
    }

    revalidatePath("/library")

    return data
}

export async function updateBook(
    id: string,
    updates: TablesUpdate<"books">
): Promise<boolean> {
    const supabase = await createClient()

    const { error } = await supabase.from("books").update(updates).eq("id", id)

    revalidatePath("/library")

    return !error
}

export async function deleteBook(id: string): Promise<boolean> {
    const supabase = await createClient()

    const { error } = await supabase.from("books").delete().eq("id", id)

    revalidatePath("/library")

    return !error
}

// Highlight operations
export async function getHighlights(
    bookId: string
): Promise<Tables<"highlights">[]> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from("highlights")
        .select("*")
        .eq("book_id", bookId)
        .order("created_at", { ascending: false })

    if (error) {
        console.error("Error fetching highlights:", error)
        return []
    }

    return data || []
}

export async function addHighlight(
    highlight: TablesInsert<"highlights">
): Promise<Tables<"highlights"> | null> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from("highlights")
        .insert(highlight)
        .select()
        .single()

    if (error) {
        console.error("Error adding highlight:", error)
        return null
    }

    return data
}

export async function updateHighlight(
    id: string,
    updates: TablesUpdate<"highlights">
): Promise<boolean> {
    const supabase = await createClient()

    const { error } = await supabase
        .from("highlights")
        .update(updates)
        .eq("id", id)

    return !error
}

export async function deleteHighlight(id: string): Promise<boolean> {
    const supabase = await createClient()

    const { error } = await supabase.from("highlights").delete().eq("id", id)

    return !error
}
