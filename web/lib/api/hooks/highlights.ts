import { Highlight, HighlightCreate, HighlightUpdate } from "@/types/api"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ApiClient } from "../client"

const HIGHLIGHTS_QUERY_KEY = "highlights"

export function useBookHighlights(bookId: string) {
    return useQuery({
        queryKey: [HIGHLIGHTS_QUERY_KEY, bookId],
        queryFn: () => ApiClient.get<Highlight[]>(`/api/v1/highlights/book/${bookId}`),
    })
}

export function useCreateHighlight() {
    const queryClient = useQueryClient()
    return useMutation<Highlight, Error, HighlightCreate>({
        mutationFn: (highlight) =>
            ApiClient.post<Highlight>("/api/v1/highlights", highlight),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: [HIGHLIGHTS_QUERY_KEY, variables.book_id],
            })
        },
    })
}

type UpdateHighlightVariables = { highlightId: string; highlight: HighlightUpdate }
export function useUpdateHighlight() {
    const queryClient = useQueryClient()
    return useMutation<Highlight, Error, UpdateHighlightVariables>({
        mutationFn: ({ highlightId, highlight }) =>
            ApiClient.put<Highlight>(`/api/v1/highlights/${highlightId}`, highlight),
        onSuccess: (_, { highlightId }) => {
            queryClient.invalidateQueries({ queryKey: [HIGHLIGHTS_QUERY_KEY] })
        },
    })
}

export function useDeleteHighlight() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (highlightId: string) =>
            ApiClient.delete(`/api/v1/highlights/${highlightId}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [HIGHLIGHTS_QUERY_KEY] })
        },
    })
}

export function useDeleteHighlightsByText() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (text: string) =>
            ApiClient.delete(`/api/v1/highlights/text/${encodeURIComponent(text)}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [HIGHLIGHTS_QUERY_KEY] })
        },
    })
}

type UpdateHighlightNoteVariables = { highlightId: string; note: string }
export function useUpdateHighlightNote() {
    const queryClient = useQueryClient()
    return useMutation<Highlight, Error, UpdateHighlightNoteVariables>({
        mutationFn: ({ highlightId, note }) =>
            ApiClient.put<Highlight>(`/api/v1/highlights/${highlightId}/note`, { note }),
        onSuccess: (_, { highlightId }) => {
            queryClient.invalidateQueries({ queryKey: [HIGHLIGHTS_QUERY_KEY] })
        },
    })
} 