import { ChatbotType } from "@/components/recall/chatbot"
import { ApiClient } from "./client"

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

export interface GradeResponse {
    score: number
    feedback: string
    aspects: {
        accuracy: number
        depth: number
        clarity: number
    }
}

export const CommandService = {
    async executeCommand(
        type: string,
        message: string,
        bookId?: string,
        history: any[] = [],
        imageUrl?: string,
        useRag?: boolean
    ) {
        return ApiClient.fetch(`/command/${type}`, {
            method: "POST",
            body: {
                message,
                book_id: bookId,
                history,
                ...(imageUrl && { image_url: imageUrl }),
                ...(useRag !== undefined && { use_rag: useRag }),
            },
            upgradeDialogMessage: {
                title: "Daily AI action limit reached",
                description:
                    "Upgrade to Pro for unlimited AI actions and personalized learning.",
            },
        })
    },

    async generateFlashcards(
        message: string,
        sessionId: string,
        bookId: string,
        imageUrl?: string
    ) {
        return ApiClient.fetch("/flashcards/generate-flashcards", {
            method: "POST",
            body: {
                history: message ? [["", message]] : [],
                session_id: sessionId,
                ...(imageUrl && { image_url: imageUrl }),
                book_id: bookId,
            },
        })
    },
}

export const UploadService = {
    async uploadDocument(formData: FormData, signal?: AbortSignal) {
        return ApiClient.uploadFile("/upload/", formData, signal, {
            title: "Storage limit reached",
            description:
                "Upgrade to Pro to upload more documents and access unlimited storage.",
        })
    },
}

export const RecallService = {
    async extractQuestions(
        bookId: string,
        message: string,
        highlights: string[] = []
    ) {
        return ApiClient.fetch("/concept/extract", {
            method: "POST",
            body: {
                book_id: bookId,
                message,
                highlights,
            },
            upgradeDialogMessage: {
                title: "Daily question limit reached",
                description:
                    "Upgrade to Pro to generate more questions and enhance your learning experience.",
            },
        })
    },

    async gradeResponse(
        history: [string, string][],
        sessionId: string
    ): Promise<GradeResponse> {
        return ApiClient.fetch("/grade/", {
            method: "POST",
            body: {
                history,
                session_id: sessionId,
            },
            upgradeDialogMessage: {
                title: "Daily grading limit reached",
                description:
                    "Upgrade to Pro for unlimited response grading and detailed feedback.",
            },
        })
    },

    async generateFlashcards(
        history: [string, string][],
        sessionId: string,
        bookId: string
    ) {
        return ApiClient.fetch("/flashcards/generate-flashcards", {
            method: "POST",
            body: {
                history,
                session_id: sessionId,
                for_recall: true,
                book_id: bookId,
            },
            upgradeDialogMessage: {
                title: "Daily flashcard limit reached",
                description:
                    "Upgrade to Pro to generate unlimited flashcards and enhance your study sessions.",
            },
        })
    },

    async regenerateQuestion(
        concept: string,
        recallMethod: string,
        originalQuestion: string,
        bookId: string
    ): Promise<Question> {
        return ApiClient.fetch("/concept/regenerate-question", {
            method: "POST",
            body: {
                concept,
                recall_method: recallMethod,
                original_question: originalQuestion,
                book_id: bookId,
            },
            upgradeDialogMessage: {
                title: "Daily question regeneration limit reached",
                description:
                    "Upgrade to Pro for unlimited question regeneration and personalized learning.",
            },
        })
    },

    async sendChatMessage(
        type: ChatbotType,
        params: {
            message: string
            history: [string, string][]
            book_id?: string
            session_id: string
        }
    ) {
        return ApiClient.fetch(`/recall/${type}`, {
            method: "POST",
            body: params,
            upgradeDialogMessage: {
                title: "Daily chat limit reached",
                description:
                    "Upgrade to Pro for unlimited AI chat interactions and enhanced learning support.",
            },
        })
    },
}

// Zola-style streaming chat API
export async function fetchStreamChat(
    message: string,
    history?: [string, string][],
    bookId?: string,
    upgradeDialogMessage: { title: string; description: string } = {
        title: "Daily chat limit reached",
        description:
            "Upgrade to Pro for unlimited AI chat interactions and enhanced learning support.",
    }
): Promise<AsyncIterable<string>> {
    // Make sure we have a valid history array to prevent API errors
    const validHistory =
        Array.isArray(history) && history.length > 0
            ? history.filter((pair) => pair.length === 2 && pair[0] && pair[1]) // Ensure each pair has valid messages
            : []

    return ApiClient.fetchStream("/command/custom", {
        method: "POST",
        body: {
            message,
            history: validHistory,
            book_id: bookId,
        },
        upgradeDialogMessage,
    })
}

// Generic streaming command API that can be used for all command types
export async function fetchStreamCommand(
    type: string,
    message: string,
    bookId?: string,
    history?: [string, string][],
    imageUrl?: string,
    useRag?: boolean,
    upgradeDialogMessage: { title: string; description: string } = {
        title: "Daily AI action limit reached",
        description:
            "Upgrade to Pro for unlimited AI actions and personalized learning.",
    }
): Promise<AsyncIterable<string>> {
    // Make sure we have a valid history array to prevent API errors
    const validHistory =
        Array.isArray(history) && history.length > 0
            ? history.filter((pair) => pair.length === 2 && pair[0] && pair[1]) // Ensure each pair has valid messages
            : []

    return ApiClient.fetchStream(`/command/${type}`, {
        method: "POST",
        body: {
            message,
            history: validHistory,
            book_id: bookId,
            ...(imageUrl && { image_url: imageUrl }),
            ...(useRag !== undefined && { use_rag: useRag }),
        },
        upgradeDialogMessage,
    })
}
