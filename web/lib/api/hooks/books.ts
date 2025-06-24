import {
    UserBookLibrary,
    UserBookLibraryCreate,
    UserBookLibraryUpdate,
} from "@/types/api"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ApiClient } from "../client"

export const BOOKS_QUERY_KEY = "books"

export function useBooks(userId: string) {
    return useQuery({
        queryKey: [BOOKS_QUERY_KEY, userId],
        queryFn: () => ApiClient.books.getUserBooks(),
    })
}

export function useBook(bookId: string) {
    return useQuery({
        queryKey: [BOOKS_QUERY_KEY, bookId],
        queryFn: () => ApiClient.books.getBook(bookId),
    })
}

export function useCreateBook() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (book: UserBookLibraryCreate) =>
            ApiClient.books.createBook(book),
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
            ApiClient.books.updateBook(bookId, book),
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
            ApiClient.books.deleteBook(bookId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [BOOKS_QUERY_KEY] })
        },
    })
}

export function useDeleteBookMetadata() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (metadataId: string) =>
            ApiClient.books.deleteBookMetadata(metadataId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [BOOKS_QUERY_KEY] })
        },
    })
}

type UpdateBookProgressVariables = {
    bookId: string
    progress: UserBookLibraryUpdate
}
export function useUpdateBookProgress() {
    const queryClient = useQueryClient()
    return useMutation<UserBookLibrary, Error, UpdateBookProgressVariables>({
        mutationFn: ({ bookId, progress }) =>
            ApiClient.books.updateBookProgress(bookId, progress),
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
