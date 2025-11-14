import { create } from 'zustand';

interface ArticleActionCallbacks {
  onMarkAsRead?: (articleId: string) => void;
  onMarkAsUnread?: (articleId: string) => void;
  onSaveArticle?: (articleId: string) => void;
}

interface ArticleActionsState {
  // Registry of callbacks keyed by article ID
  callbacks: Map<string, ArticleActionCallbacks>;
  // Register callbacks for an article
  registerCallbacks: (articleId: string, callbacks: ArticleActionCallbacks) => void;
  // Unregister callbacks for an article
  unregisterCallbacks: (articleId: string) => void;
  // Get callbacks for an article
  getCallbacks: (articleId: string) => ArticleActionCallbacks | undefined;
  // Execute mark as read
  executeMarkAsRead: (articleId: string) => void;
  // Execute mark as unread
  executeMarkAsUnread: (articleId: string) => void;
  // Execute save article
  executeSaveArticle: (articleId: string) => void;
}

export const useArticleActionsStore = create<ArticleActionsState>((set, get) => ({
  callbacks: new Map(),

  registerCallbacks: (articleId, callbacks) => {
    set((state) => {
      const newCallbacks = new Map(state.callbacks);
      newCallbacks.set(articleId, callbacks);
      return { callbacks: newCallbacks };
    });
  },

  unregisterCallbacks: (articleId) => {
    set((state) => {
      const newCallbacks = new Map(state.callbacks);
      newCallbacks.delete(articleId);
      return { callbacks: newCallbacks };
    });
  },

  getCallbacks: (articleId) => {
    return get().callbacks.get(articleId);
  },

  executeMarkAsRead: (articleId) => {
    const callbacks = get().callbacks.get(articleId);
    callbacks?.onMarkAsRead?.(articleId);
  },

  executeMarkAsUnread: (articleId) => {
    const callbacks = get().callbacks.get(articleId);
    callbacks?.onMarkAsUnread?.(articleId);
  },

  executeSaveArticle: (articleId) => {
    const callbacks = get().callbacks.get(articleId);
    callbacks?.onSaveArticle?.(articleId);
  },
}));
