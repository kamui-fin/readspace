import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClientProvider } from "../client-provider";
import type { Highlight, HighlightCreate, HighlightUpdate } from "../types";

const HIGHLIGHTS_QUERY_KEY = "highlights";

export function useBookHighlights(bookId: string) {
  return useQuery({
    queryKey: [HIGHLIGHTS_QUERY_KEY, bookId],
    queryFn: () => ClientProvider.getClient().highlights.getBookHighlights(bookId),
  });
}

export function useCreateHighlight() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (highlight: HighlightCreate) =>
      ClientProvider.getClient().highlights.createHighlight(highlight),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [HIGHLIGHTS_QUERY_KEY] });
    },
  });
}

type UpdateHighlightVariables = {
  highlightId: string;
  highlight: HighlightUpdate;
};
export function useUpdateHighlight() {
  const queryClient = useQueryClient();
  return useMutation<Highlight, Error, UpdateHighlightVariables>({
    mutationFn: ({ highlightId, highlight }) =>
      ClientProvider.getClient().highlights.updateHighlight(highlightId, highlight),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [HIGHLIGHTS_QUERY_KEY] });
    },
  });
}

export function useDeleteHighlight() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (highlightId: string) =>
      ClientProvider.getClient().highlights.deleteHighlight(highlightId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [HIGHLIGHTS_QUERY_KEY] });
    },
  });
}

export function useDeleteHighlightByText() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (text: string) =>
      ClientProvider.getClient().highlights.deleteHighlightByText(text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [HIGHLIGHTS_QUERY_KEY] });
    },
  });
}

export function useUpdateHighlightNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      highlightId,
      note,
    }: {
      highlightId: string;
      note: string;
    }) => ClientProvider.getClient().highlights.updateHighlightNote(highlightId, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [HIGHLIGHTS_QUERY_KEY] });
    },
  });
}
