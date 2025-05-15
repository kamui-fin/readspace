import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "../client"
import { Book, BookCreate, BookProgress, BookUpdate } from "@/types/api"

const BOOKS_QUERY_KEY = "books"

export function useBooks(userId: string) {
    return useQuery({
        queryKey: [BOOKS_QUERY_KEY, userId],
        queryFn: () => api.get<Book[]>(`/api/v1/books?user_id=${userId}`),
    })
}

export function useBook(bookId: string) {
    return useQuery({
        queryKey: [BOOKS_QUERY_KEY, bookId],
        queryFn: () => api.get<Book>(`/api/v1/books/${bookId}`),
    })
}

export function useCreateBook() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (book: BookCreate) => api.post<Book>("/api/v1/books", book),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [BOOKS_QUERY_KEY] })
        },
    })
}

export function useUpdateBook() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ bookId, book }: { bookId: string; book: BookUpdate }) =>
            api.put<Book>(`/api/v1/books/${bookId}`, book),
        onSuccess: (_: Book, { bookId }: { bookId: string }) => {
            queryClient.invalidateQueries({ queryKey: [BOOKS_QUERY_KEY, bookId] })
        },
    })
}

export function useDeleteBook() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (bookId: string) => api.delete(`/api/v1/books/${bookId}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [BOOKS_QUERY_KEY] })
        },
    })
}

export function useUpdateBookProgress() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ bookId, progress }: { bookId: string; progress: BookProgress }) =>
            api.put<Book>(`/api/v1/books/${bookId}/progress`, progress),
        onSuccess: (_: Book, { bookId }: { bookId: string }) => {
            queryClient.invalidateQueries({ queryKey: [BOOKS_QUERY_KEY, bookId] })
        },
    })
}

export function useUpdateBookLanguage() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ bookId, language }: { bookId: string; language: string }) =>
            api.put<Book>(`/api/v1/books/${bookId}/language`, { language }),
        onSuccess: (_: Book, { bookId }: { bookId: string }) => {
            queryClient.invalidateQueries({ queryKey: [BOOKS_QUERY_KEY, bookId] })
        },
    })
} 