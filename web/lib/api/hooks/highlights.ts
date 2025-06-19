import { Highlight, HighlightCreate, HighlightUpdate } from "@/types/api"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ApiClient } from "../client"

const HIGHLIGHTS_QUERY_KEY = "highlights"

export function useBookHighlights(bookId: string) {
    return useQuery({
        queryKey: [HIGHLIGHTS_QUERY_KEY, bookId],
        queryFn: () =>
            ApiClient.get<Highlight[]>(`/api/highlights/book/${bookId}`),
    })
}

export function useCreateHighlight() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (highlight: HighlightCreate) =>
            ApiClient.post<Highlight>("/api/highlights/", highlight),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [HIGHLIGHTS_QUERY_KEY] })
        },
    })
}

type UpdateHighlightVariables = {
    highlightId: string
    highlight: HighlightUpdate
}
export function useUpdateHighlight() {
    const queryClient = useQueryClient()
    return useMutation<Highlight, Error, UpdateHighlightVariables>({
        mutationFn: ({ highlightId, highlight }) =>
            ApiClient.put<Highlight>(
                `/api/highlights/${highlightId}`,
                highlight
            ),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [HIGHLIGHTS_QUERY_KEY] })
        },
    })
}

export function useDeleteHighlight() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (highlightId: string) =>
            ApiClient.delete(`/api/highlights/${highlightId}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [HIGHLIGHTS_QUERY_KEY] })
        },
    })
}

export function useDeleteHighlightByText() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (text: string) =>
            ApiClient.delete(
                `/api/highlights/text/${encodeURIComponent(text)}`
            ),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [HIGHLIGHTS_QUERY_KEY] })
        },
    })
}

export function useUpdateHighlightNote() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({
            highlightId,
            note,
        }: {
            highlightId: string
            note: string
        }) => ApiClient.put(`/api/highlights/${highlightId}/note`, { note }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [HIGHLIGHTS_QUERY_KEY] })
        },
    })
}
