import { env } from "@/env" // Import validated env
import { getSession } from "@/lib/auth/supabase"
import { HTTPError } from "@/lib/errors"

interface ApiClientOptions {
    method?: string
    body?: any
    headers?: HeadersInit
    signal?: AbortSignal
}

const API_URL = env.NEXT_PUBLIC_API_BASE_URL

export class ApiError extends Error {
    constructor(public status: number, message: string) {
        super(message)
        this.name = "ApiError"
    }
}

async function handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: "An error occurred" }))
        throw new ApiError(response.status, error.message || "An error occurred")
    }
    return response.json()
}

export class ApiClient {
    private static baseUrl = env.NEXT_PUBLIC_API_BASE_URL

    public static async getAuthHeaders(): Promise<HeadersInit> {
        const session = await getSession()
        const headers: HeadersInit = {
            "Content-Type": "application/json",
        }

        if (session?.access_token) {
            headers["Authorization"] = `Bearer ${session.access_token}`
        }

        return headers
    }

    private static async getAuthHeadersForUpload(): Promise<HeadersInit> {
        const session = await getSession()
        const headers: HeadersInit = {}

        if (session?.access_token) {
            headers["Authorization"] = `Bearer ${session.access_token}`
        }

        return headers
    }
    static async fetch(endpoint: string, options: ApiClientOptions = {}) {
        try {
            const headers = await this.getAuthHeaders()

            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                method: options.method || "GET",
                headers: {
                    ...headers,
                    ...options.headers,
                },
                body: options.body ? JSON.stringify(options.body) : undefined,
                credentials: "include",
                mode: "cors",
                signal: options.signal,
            })

            if (!response.ok) {
                const responseText = await response.text()
                throw new HTTPError(response.status, responseText)
            }

            // Handle different content types
            const contentType = response.headers.get("content-type")
            if (contentType?.includes("application/json")) {
                return await response.json()
            }
            return await response.text()
        } catch (error) {
            throw error
        }
    }

    // File upload specific method
    static async uploadFile(
        endpoint: string,
        formData: FormData,
        signal?: AbortSignal
    ) {
        try {
            const headers = await this.getAuthHeadersForUpload()

            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                method: "POST",
                headers,
                body: formData,
                credentials: "include",
                mode: "cors",
                signal,
            })

            if (!response.ok) {
                const responseText = await response.text()
                throw new HTTPError(response.status, responseText)
            }

            return await response.json()
        } catch (error) {
            throw error
        }
    }
}

export const api = {
    async get<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
        const url = new URL(`${API_URL}${endpoint}`)
        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                url.searchParams.append(key, value)
            })
        }
        const response = await fetch(url.toString(), {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
        })
        return handleResponse<T>(response)
    },

    async post<T>(endpoint: string, data: unknown): Promise<T> {
        const response = await fetch(`${API_URL}${endpoint}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(data),
        })
        return handleResponse<T>(response)
    },

    async put<T>(endpoint: string, data: unknown): Promise<T> {
        const response = await fetch(`${API_URL}${endpoint}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(data),
        })
        return handleResponse<T>(response)
    },

    async delete(endpoint: string): Promise<void> {
        const response = await fetch(`${API_URL}${endpoint}`, {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json",
            },
        })
        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: "An error occurred" }))
            throw new ApiError(response.status, error.message || "An error occurred")
        }
    },
}
