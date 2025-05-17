import { env } from "@/env"
import { getSession } from "@/lib/auth/supabase"
import { createClient } from "@/lib/supabase/server"

export class ApiError extends Error {
    constructor(
        public status: number,
        message: string
    ) {
        super(message)
        this.name = "ApiError"
    }
}

// Helper function to get auth headers
async function getAuthHeaders(): Promise<HeadersInit> {
    const headers: HeadersInit = {
        "Content-Type": "application/json",
    }

    try {
        // Try server-side auth first
        const supabase = await createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.access_token) {
            headers["Authorization"] = `Bearer ${session.access_token}`
            return headers
        }
    } catch {
        // If server-side auth fails, try client-side auth
        const session = await getSession()
        if (session?.access_token) {
            headers["Authorization"] = `Bearer ${session.access_token}`
        }
    }

    return headers
}

async function handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
        const error = await response
            .json()
            .catch(() => ({ message: "An error occurred" }))
        throw new ApiError(
            response.status,
            error.message || "An error occurred"
        )
    }
    return response.json()
}

export class ApiClient {
    private static baseUrl = env.NEXT_PUBLIC_API_BASE_URL || "http://0.0.0.0:8008"

    static async fetch<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        try {
            const headers = await getAuthHeaders()
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                ...options,
                headers: {
                    ...headers,
                    ...options.headers,
                },
                cache: "no-store", // Disable caching for authenticated requests
            })

            return handleResponse<T>(response)
        } catch (error) {
            if (error instanceof ApiError && error.status === 401) {
                throw new Error("Authentication required")
            }
            throw error
        }
    }

    static async get<T>(endpoint: string, options?: RequestInit): Promise<T> {
        return this.fetch<T>(endpoint, { ...options, method: "GET" })
    }

    static async post<T>(
        endpoint: string,
        data?: any,
        options?: RequestInit
    ): Promise<T> {
        return this.fetch<T>(endpoint, {
            ...options,
            method: "POST",
            body: data ? JSON.stringify(data) : undefined,
        })
    }

    static async put<T>(
        endpoint: string,
        data?: any,
        options?: RequestInit
    ): Promise<T> {
        return this.fetch<T>(endpoint, {
            ...options,
            method: "PUT",
            body: data ? JSON.stringify(data) : undefined,
        })
    }

    static async delete<T>(
        endpoint: string,
        options?: RequestInit
    ): Promise<T> {
        return this.fetch<T>(endpoint, { ...options, method: "DELETE" })
    }

    static async uploadFile(
        endpoint: string,
        formData: FormData,
        signal?: AbortSignal
    ): Promise<any> {
        const headers = await getAuthHeaders()
        // Remove Content-Type header for form data to let the browser set it with the boundary
        const { "Content-Type": _, ...uploadHeaders } = headers as Record<string, string>
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            method: "POST",
            body: formData,
            signal,
            headers: uploadHeaders,
        })

        return handleResponse(response)
    }

    // Book endpoints
    static books = {
        getUserBooks: () => this.get("/books"),
        getBook: (id: string) => this.get(`/books/${id}`),
        createBook: (data: any) => this.post("/books", data),
        updateBook: (id: string, data: any) => this.put(`/books/${id}`, data),
        deleteBook: (id: string) => this.delete(`/books/${id}`),
    }

    // Highlight endpoints
    static highlights = {
        getBookHighlights: (bookId: string) =>
            this.get(`/books/${bookId}/highlights`),
        createHighlight: (bookId: string, data: any) =>
            this.post(`/books/${bookId}/highlights`, data),
        updateHighlight: (bookId: string, highlightId: string, data: any) =>
            this.put(`/books/${bookId}/highlights/${highlightId}`, data),
        deleteHighlight: (bookId: string, highlightId: string) =>
            this.delete(`/books/${bookId}/highlights/${highlightId}`),
    }
}