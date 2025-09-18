import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiClient } from "../client";
import { BOOK_QUERY_KEYS } from "../query-keys";
import type {
  BookMetadataCreate,
  UserBookLibrary,
  UserBookLibraryUpdate,
} from "../types";

export function useBooks(userId: string) {
  return useQuery({
    queryKey: [BOOK_QUERY_KEYS.BOOKS, userId],
    queryFn: () => ApiClient.books.getUserBooks(),
    enabled: !!userId, // Only run query if userId exists
  });
}

export function useBook(bookId: string) {
  return useQuery({
    queryKey: [BOOK_QUERY_KEYS.BOOK, bookId],
    queryFn: () => ApiClient.books.getBook(bookId),
  });
}

export function useCreateBook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (book: BookMetadataCreate) => ApiClient.books.createBook(book),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BOOK_QUERY_KEYS.BOOKS] });
    },
  });
}

type UpdateBookVariables = { bookId: string; book: UserBookLibraryUpdate };
export function useUpdateBook() {
  const queryClient = useQueryClient();
  return useMutation<UserBookLibrary, Error, UpdateBookVariables>({
    mutationFn: ({ bookId, book }) => ApiClient.books.updateBook(bookId, book),
    onSuccess: (_, { bookId }) => {
      queryClient.invalidateQueries({
        queryKey: [BOOK_QUERY_KEYS.BOOK, bookId],
      });
      queryClient.invalidateQueries({
        queryKey: [BOOK_QUERY_KEYS.BOOKS],
      });
    },
  });
}

export function useDeleteBook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bookId: string) => ApiClient.books.deleteBook(bookId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BOOK_QUERY_KEYS.BOOKS] });
    },
  });
}

export function useDeleteBookMetadata() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (metadataId: string) =>
      ApiClient.books.deleteBookMetadata(metadataId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BOOK_QUERY_KEYS.BOOKS] });
    },
  });
}

type UpdateBookProgressVariables = {
  bookId: string;
  progress: UserBookLibraryUpdate;
};
export function useUpdateBookProgress() {
  const queryClient = useQueryClient();
  return useMutation<UserBookLibrary, Error, UpdateBookProgressVariables>({
    mutationFn: ({ bookId, progress }) =>
      ApiClient.books.updateBookProgress(bookId, progress),
    onSuccess: (_, { bookId }) => {
      queryClient.invalidateQueries({
        queryKey: [BOOK_QUERY_KEYS.BOOK, bookId],
      });
      queryClient.invalidateQueries({
        queryKey: [BOOK_QUERY_KEYS.BOOKS],
      });
    },
  });
}
