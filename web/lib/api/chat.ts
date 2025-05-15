import { ChatbotType } from "@/components/recall/chatbot"
import { env } from "@/env"
import { getSession } from "@/lib/auth/supabase"

const API_BASE_URL = env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8008"

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

// Default fetch options to be used with all API calls
const getDefaultFetchOptions = async (
    method: string,
    body?: any
): Promise<RequestInit> => {
    return {
        method,
        headers: await getAuthHeaders(),
        body: body ? JSON.stringify(body) : undefined,
        credentials: "include",
        mode: "cors",
    }
}

export interface QueryRequest {
    text: string
    book_id: string
    page_range?: [number, number]
    session_id?: string
}

export interface ChatRequest {
    message: string
    book_id: string
    history: [string, string][]
    session_id: string
}

export interface UploadResponse {
    status: string
    chunks_inserted: number
    document: string
}

export interface Question {
    id: string | number
    concept: string
    recall_method: ChatbotType
    question: string
    choices?: string[]
    answerIndex?: number
    answerExplanation?: string
    starting_msg?: string
    type: "multiple_choice" | "simple"
}

export interface QuestionExtractionResponse {
    questions: Question[]
}

export interface ExtractRequest {
    book_id: string
    message: string
    highlights?: string[]
}

export interface GradeRequest {
    history: [string, string][]
    session_id: string
}

export interface GradeResponse {
    score: number
    feedback: string
    aspects: {
        accuracy: number
        depth: number
        clarity: number
    }
}

/**
 * Sends a command to the server
 */
export async function sendCommand(
    commandName: string,
    request: QueryRequest
): Promise<Response> {
    const options = await getDefaultFetchOptions("POST", request)

    const response = await fetch(
        `${API_BASE_URL}/command/${commandName}`,
        options
    )

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || "Command failed")
    }

    return response
}

/**
 * Sends a chat message to the server
 */
export async function sendChatMessage(
    chatName: string,
    request: ChatRequest
): Promise<Response> {
    const options = await getDefaultFetchOptions("POST", request)

    const response = await fetch(`${API_BASE_URL}/recall/${chatName}`, options)

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || "Chat failed")
    }

    return response
}

/**
 * Helper function to create a new session ID
 */
export function createSessionId(): string {
    return crypto.randomUUID()
}

/**
 * Helper function to format chat history
 */
export function formatChatHistory(
    messages: { role: string; content: string }[]
): [string, string][] {
    return messages.map((msg) => [msg.role, msg.content])
}

export async function extractQuestions(
    request: ExtractRequest
): Promise<Question[]> {
    const options = await getDefaultFetchOptions("POST", request)

    const response = await fetch(`${API_BASE_URL}/concept/extract`, options)

    if (!response.ok) {
        throw new Error("Failed to extract questions")
    }

    const data = (await response.json()) as QuestionExtractionResponse
    return data.questions.map((question, idx) => ({
        ...question,
        id: idx,
    }))
}

export async function gradeResponse(
    request: GradeRequest
): Promise<GradeResponse> {
    const options = await getDefaultFetchOptions("POST", request)

    const response = await fetch(`${API_BASE_URL}/grade/`, options)

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || "Grading failed")
    }

    return response.json()
}

export async function generateFlashcards(
    history: [string, string][],
    sessionId: string,
    forRecall: boolean = false
) {
    const options = await getDefaultFetchOptions("POST", {
        history,
        session_id: sessionId,
        for_recall: forRecall,
    })

    const response = await fetch(
        `${API_BASE_URL}/flashcards/generate-flashcards`,
        options
    )

    if (!response.ok) {
        throw new Error("Failed to generate flashcards")
    }

    return response.json()
}

/**
 * Regenerate a question with a different recall method
 */
export async function regenerateQuestion(
    concept: string,
    recall_method: string,
    original_question: string,
    book_id: string
): Promise<Question> {
    const options = await getDefaultFetchOptions("POST", {
        concept,
        recall_method,
        original_question,
        book_id,
    })

    const response = await fetch(
        `${API_BASE_URL}/concept/regenerate-question`,
        options
    )

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || "Failed to regenerate question")
    }

    return response.json()
}
