import { env } from "@/env" // Import validated env
import { getSession } from "@/lib/auth/supabase"

const API_BASE_URL = env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000"

// Helper function to get auth headers
async function getAuthHeaders(): Promise<HeadersInit> {
    const headers: HeadersInit = {
        "Content-Type": "application/json",
    }

    try {
        const session = await getSession()
        if (session?.access_token) {
            headers["Authorization"] = `Bearer ${session.access_token}`
        }
    } catch (error) {
        console.error("Error getting auth token:", error)
    }

    return headers
}

export class ApiError extends Error {
    constructor(
        public status: number,
        message: string
    ) {
        super(message)
        this.name = "ApiError"
    }
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
    private static async fetch<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        const headers = await getAuthHeaders()
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers: {
                ...headers,
                ...options.headers,
            },
        })

        if (!response.ok) {
            const error = await response.json().catch(() => ({}))
            throw new Error(error.detail || "An error occurred")
        }

        return response.json()
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
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: "POST",
            body: formData,
            signal,
        })

        if (!response.ok) {
            const error = await response.json().catch(() => ({}))
            throw new Error(error.detail || "Upload failed")
        }

        return response.json()
    }
}
