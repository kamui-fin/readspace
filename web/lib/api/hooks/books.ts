import { UserBookLibrary, UserBookLibraryCreate, UserBookLibraryUpdate } from "@/types/api"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ApiClient } from "../client"

export const BOOKS_QUERY_KEY = "books"

export function useBooks(userId: string) {
    return useQuery({
        queryKey: [BOOKS_QUERY_KEY, userId],
        queryFn: () => ApiClient.get<UserBookLibrary[]>(`/books?user_id=${userId}`),
    })
}

export function useBook(bookId: string) {
    return useQuery({
        queryKey: [BOOKS_QUERY_KEY, bookId],
        queryFn: () => ApiClient.get<UserBookLibrary>(`/api/books/${bookId}`),
    })
}

export function useCreateBook() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (book: UserBookLibraryCreate) =>
            ApiClient.post<UserBookLibrary>("/books", book),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [BOOKS_QUERY_KEY] })
        },
    })
}

type UpdateBookVariables = { bookId: string; book: UserBookLibraryUpdate }
export function useUpdateBook() {
    const queryClient = useQueryClient()
    return useMutation<UserBookLibrary, Error, UpdateBookVariables>({
        mutationFn: ({ bookId, book }) =>
            ApiClient.put<UserBookLibrary>(`/api/books/${bookId}`, book),
        onSuccess: (_, { bookId }) => {
            queryClient.invalidateQueries({
                queryKey: [BOOKS_QUERY_KEY, bookId],
            })
            queryClient.invalidateQueries({
                queryKey: [BOOKS_QUERY_KEY],
            })
        },
    })
}

export function useDeleteBook() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (bookId: string) =>
            ApiClient.delete(`/api/books/${bookId}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [BOOKS_QUERY_KEY] })
        },
    })
}

export function useDeleteBookMetadata() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (metadataId: string) =>
            ApiClient.delete(`/api/books/metadata/${metadataId}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [BOOKS_QUERY_KEY] })
        },
    })
}

type UpdateBookProgressVariables = { bookId: string; progress: UserBookLibraryUpdate }
export function useUpdateBookProgress() {
    const queryClient = useQueryClient()
    return useMutation<UserBookLibrary, Error, UpdateBookProgressVariables>({
        mutationFn: ({ bookId, progress }) =>
            ApiClient.put<UserBookLibrary>(`/api/books/${bookId}/progress`, progress),
        onSuccess: (_, { bookId }) => {
            queryClient.invalidateQueries({
                queryKey: [BOOKS_QUERY_KEY, bookId],
            })
            queryClient.invalidateQueries({
                queryKey: [BOOKS_QUERY_KEY],
            })
        },
    })
}