import { createClient } from "@/lib/supabase/client"

const BUCKET_NAME = "documents"

/**
 * Upload a file to Supabase Storage
 *
 * @param file The file to upload
 * @param fileName Optional custom file name
 * @returns Object containing the file path and success status
 */
export async function uploadFileToSupabase(
    file: File,
    fileName?: string
): Promise<{ path: string; success: boolean }> {
    const supabase = createClient()
    const fileExt = file.name.split(".").pop()
    const objectName = fileName || `${crypto.randomUUID()}.${fileExt}`

    const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(objectName, file, {
            cacheControl: "3600",
            upsert: false,
        })

    return {
        path: data?.path || "",
        success: !error,
    }
}

/**
 * Upload an image to Supabase Storage
 *
 * @param file The image file to upload
 * @param fileName Optional custom file name
 * @returns Object containing the public URL and success status
 */
export async function uploadImageToSupabase(
    file: File | Blob,
    userId: string,
    fileName?: string
): Promise<{ url: string; success: boolean }> {
    const supabase = createClient()
    const fileExt = fileName ? fileName.split(".").pop() : "png"
    const objectName = `${userId}/${crypto.randomUUID()}.${fileExt}`

    const { data, error } = await supabase.storage
        .from("images")
        .upload(objectName, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: "image/*",
        })

    if (error || !data?.path) {
        return {
            url: "",
            success: false,
        }
    }

    return {
        url: data.path,
        success: true,
    }
}

/**
 * Get a file from Supabase Storage
 *
 * @param path The path of the file in the bucket
 * @returns Object containing the file data and success status
 */
export async function getFileFromSupabase(path: string): Promise<{
    data: Blob | null
    success: boolean
    error: any
    message: string
}> {
    const supabase = createClient()
    let effectivePath = path
    if (path === "public/sample.pdf") {
        effectivePath = "public/sample.pdf"
    } else {
        effectivePath = path.split("/").slice(1).join("/")
    }
    const { data, error } = await supabase.storage
        .from("documents")
        .download(effectivePath)

    return {
        data,
        success: !error,
        error,
        message: error?.message || "",
    }
}

/**
 * Delete a file from Supabase Storage
 *
 * @param path The path of the file in the bucket
 * @returns Success status
 */
export async function deleteFileFromSupabase(path: string): Promise<boolean> {
    const supabase = createClient()

    const { error } = await supabase.storage.from(BUCKET_NAME).remove([path])

    return !error
}

/**
 * List all files in the Supabase Storage bucket
 *
 * @returns Array of file paths
 */
export async function listSupabaseObjects(): Promise<string[]> {
    const supabase = createClient()

    const { data, error } = await supabase.storage.from(BUCKET_NAME).list()

    if (error || !data) {
        return []
    }

    return data.map((item) => item.name)
}

/**
 * Get a public URL for a file in Supabase Storage
 *
 * @param path The path of the file in the bucket
 * @returns Public URL string
 */
export function getPublicUrl(path: string): string {
    const supabase = createClient()

    const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path)

    return data.publicUrl
}
