import { Highlight, HighlightCreate, HighlightUpdate } from "@/types/api"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ApiClient } from "../client"

const HIGHLIGHTS_QUERY_KEY = "highlights"

export function useBookHighlights(bookId: string) {
    return useQuery({
        queryKey: [HIGHLIGHTS_QUERY_KEY, bookId],
        queryFn: () => ApiClient.highlights.getBookHighlights(bookId),
    })
}

export function useCreateHighlight() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (highlight: HighlightCreate) =>
            ApiClient.highlights.createHighlight(highlight),
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
            ApiClient.highlights.updateHighlight(highlightId, highlight),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [HIGHLIGHTS_QUERY_KEY] })
        },
    })
}

export function useDeleteHighlight() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (highlightId: string) =>
            ApiClient.highlights.deleteHighlight(highlightId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [HIGHLIGHTS_QUERY_KEY] })
        },
    })
}

export function useDeleteHighlightByText() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (text: string) =>
            ApiClient.highlights.deleteHighlightByText(text),
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
        }) => ApiClient.highlights.updateHighlightNote(highlightId, note),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [HIGHLIGHTS_QUERY_KEY] })
        },
    })
}
