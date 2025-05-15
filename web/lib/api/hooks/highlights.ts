import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "../client"
import { Highlight, HighlightCreate, HighlightUpdate } from "@/types/api"

const HIGHLIGHTS_QUERY_KEY = "highlights"

export function useBookHighlights(bookId: string) {
    return useQuery({
        queryKey: [HIGHLIGHTS_QUERY_KEY, bookId],
        queryFn: () => api.get<Highlight[]>(`/api/v1/highlights/book/${bookId}`),
    })
}

export function useCreateHighlight() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (highlight: HighlightCreate) =>
            api.post<Highlight>("/api/v1/highlights", highlight),
        onSuccess: (_: Highlight, { book_id }: { book_id: string }) => {
            queryClient.invalidateQueries({ queryKey: [HIGHLIGHTS_QUERY_KEY, book_id] })
        },
    })
}

export function useUpdateHighlight() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ highlightId, highlight }: { highlightId: string; highlight: HighlightUpdate }) =>
            api.put<Highlight>(`/api/v1/highlights/${highlightId}`, highlight),
        onSuccess: (_: Highlight, { highlightId }: { highlightId: string }) => {
            queryClient.invalidateQueries({ queryKey: [HIGHLIGHTS_QUERY_KEY, highlightId] })
        },
    })
}

export function useDeleteHighlight() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (highlightId: string) => api.delete(`/api/v1/highlights/${highlightId}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [HIGHLIGHTS_QUERY_KEY] })
        },
    })
}

export function useDeleteHighlightsByText() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (text: string) => api.delete(`/api/v1/highlights/text/${text}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [HIGHLIGHTS_QUERY_KEY] })
        },
    })
}

export function useUpdateHighlightNote() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ highlightId, note }: { highlightId: string; note: string }) =>
            api.put<Highlight>(`/api/v1/highlights/${highlightId}/note`, { note }),
        onSuccess: (_: Highlight, { highlightId }: { highlightId: string }) => {
            queryClient.invalidateQueries({ queryKey: [HIGHLIGHTS_QUERY_KEY, highlightId] })
        },
    })
} 