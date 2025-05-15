import { Book, BookCreate, BookProgress, BookUpdate } from "@/types/api"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ApiClient } from "../client"

const BOOKS_QUERY_KEY = "books"

export function useBooks(userId: string) {
    return useQuery({
        queryKey: [BOOKS_QUERY_KEY, userId],
        queryFn: () => ApiClient.get<Book[]>(`/api/v1/books?user_id=${userId}`),
    })
}

export function useBook(bookId: string) {
    return useQuery({
        queryKey: [BOOKS_QUERY_KEY, bookId],
        queryFn: () => ApiClient.get<Book>(`/api/v1/books/${bookId}`),
    })
}

export function useCreateBook() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (book: BookCreate) => ApiClient.post<Book>("/api/v1/books", book),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [BOOKS_QUERY_KEY] })
        },
    })
}

type UpdateBookVariables = { bookId: string; book: BookUpdate }
export function useUpdateBook() {
    const queryClient = useQueryClient()
    return useMutation<Book, Error, UpdateBookVariables>({
        mutationFn: ({ bookId, book }) =>
            ApiClient.put<Book>(`/api/v1/books/${bookId}`, book),
        onSuccess: (_, { bookId }) => {
            queryClient.invalidateQueries({ queryKey: [BOOKS_QUERY_KEY, bookId] })
        },
    })
}

export function useDeleteBook() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (bookId: string) => ApiClient.delete(`/api/v1/books/${bookId}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [BOOKS_QUERY_KEY] })
        },
    })
}

type UpdateBookProgressVariables = { bookId: string; progress: BookProgress }
export function useUpdateBookProgress() {
    const queryClient = useQueryClient()
    return useMutation<Book, Error, UpdateBookProgressVariables>({
        mutationFn: ({ bookId, progress }) =>
            ApiClient.put<Book>(`/api/v1/books/${bookId}/progress`, progress),
        onSuccess: (_, { bookId }) => {
            queryClient.invalidateQueries({ queryKey: [BOOKS_QUERY_KEY, bookId] })
        },
    })
}

type UpdateBookLanguageVariables = { bookId: string; language: string }
export function useUpdateBookLanguage() {
    const queryClient = useQueryClient()
    return useMutation<Book, Error, UpdateBookLanguageVariables>({
        mutationFn: ({ bookId, language }) =>
            ApiClient.put<Book>(`/api/v1/books/${bookId}/language`, { language }),
        onSuccess: (_, { bookId }) => {
            queryClient.invalidateQueries({ queryKey: [BOOKS_QUERY_KEY, bookId] })
        },
    })
} 