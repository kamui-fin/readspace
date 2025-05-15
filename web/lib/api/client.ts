import { env } from "@/env" // Import validated env
import { getSession } from "@/lib/auth/supabase"
import { HTTPError } from "@/lib/errors"
import { useUpgradeDialog } from "@/stores/upgrade-dialog"

interface ApiClientOptions {
    method?: string
    body?: any
    headers?: HeadersInit
    signal?: AbortSignal
    upgradeDialogMessage?: { title: string; description: string }
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

    private static handleError(
        error: any,
        upgradeDialogMessage?: { title: string; description: string }
    ) {
        // Check for storage/usage limit errors
        if (error instanceof HTTPError && error.status === 429) {
            const openUpgradeDialog = useUpgradeDialog.getState().open

            // Try to extract resource type from error response
            let customMessage = upgradeDialogMessage

            if (error.response) {
                try {
                    const errorData = JSON.parse(error.response)
                    if (errorData.detail && errorData.detail.resource) {
                        const resource = errorData.detail.resource

                        // Customize message based on the resource type
                        switch (resource) {
                            case "image":
                                customMessage = {
                                    title: "Image action limit reached for today",
                                    description:
                                        "Upgrade to Pro for unlimited image analysis and AI interactions.",
                                }
                                break
                            case "actions":
                                customMessage = {
                                    title: "Daily AI action limit reached for today",
                                    description:
                                        "Upgrade to Pro for unlimited AI actions and personalized learning.",
                                }
                                break
                            case "storage":
                                customMessage = {
                                    title: "Storage limit reached",
                                    description:
                                        "Upgrade to Pro to upload more documents and access unlimited storage.",
                                }
                                break
                            case "recall":
                                customMessage = {
                                    title: "Recall session limit reached for today",
                                    description:
                                        "Upgrade to Pro for unlimited recall sessions and enhanced learning.",
                                }
                                break
                            case "rag":
                                customMessage = {
                                    title: "Deep processing limit exceeded",
                                    description:
                                        "Upgrade to Pro for unlimited processing and comprehensive knowledge retrieval.",
                                }
                                break
                        }
                    }
                } catch (e) {
                    // If parsing fails, use the default message
                    console.error("Failed to parse error response:", e)
                }
            }

            // Use setTimeout to ensure the upgrade dialog opens after any state cleanup
            setTimeout(() => {
                openUpgradeDialog(
                    customMessage || {
                        title: "Usage limit reached",
                        description:
                            "Upgrade to Pro for unlimited usage and enhanced features.",
                    }
                )
            }, 0)
        }
        throw error
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
            return this.handleError(error, options.upgradeDialogMessage)
        }
    }

    // File upload specific method
    static async uploadFile(
        endpoint: string,
        formData: FormData,
        signal?: AbortSignal,
        upgradeDialogMessage?: { title: string; description: string }
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
            return this.handleError(error, upgradeDialogMessage)
        }
    }

    // Streaming fetch utility for text/event-stream or chunked text
    static async *fetchStream(
        endpoint: string,
        options: ApiClientOptions = {}
    ): AsyncIterable<string> {
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

            // Stream the response body as text
            const reader = response.body?.getReader()
            if (!reader) return
            const decoder = new TextDecoder()
            let done = false
            while (!done) {
                const { value, done: doneReading } = await reader.read()
                if (value) {
                    yield decoder.decode(value, { stream: !doneReading })
                }
                done = doneReading
            }
        } catch (error) {
            return this.handleError(error, options.upgradeDialogMessage)
        }
    }
}
