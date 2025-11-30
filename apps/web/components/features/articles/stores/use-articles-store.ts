import { create } from "zustand"

interface ArticlesState {
    // View State
    viewMode: "list" | "content"
    selectedArticleId: string | null
    showUnreadOnly: boolean
    sidebarOpen: boolean

    // Actions
    setViewMode: (mode: "list" | "content") => void
    selectArticle: (articleId: string | null) => void
    toggleUnreadFilter: () => void
    setSidebarOpen: (isOpen: boolean) => void
    reset: () => void
}

export const useArticlesStore = create<ArticlesState>((set) => ({
    viewMode: "list",
    selectedArticleId: null,
    showUnreadOnly: false,
    sidebarOpen: true,

    setViewMode: (mode) => set({ viewMode: mode }),
    selectArticle: (articleId) =>
        set((state) => ({
            selectedArticleId: articleId,
            // On mobile, selecting an article should switch to content view
            viewMode: articleId ? "content" : state.viewMode,
        })),
    toggleUnreadFilter: () =>
        set((state) => ({ showUnreadOnly: !state.showUnreadOnly })),
    setSidebarOpen: (isOpen) => set({ sidebarOpen: isOpen }),
    reset: () =>
        set({
            viewMode: "list",
            selectedArticleId: null,
            showUnreadOnly: false,
            sidebarOpen: true,
        }),
}))
