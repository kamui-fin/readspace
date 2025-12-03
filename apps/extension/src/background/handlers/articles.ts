import { ApiClient } from "@readspace/shared";
import { stateStore } from "../state-store";

interface SaveArticlePayload {
    url: string;
    priority?: number;
    note?: string;
    title?: string;
}

export async function handleSaveArticle(payload: SaveArticlePayload) {
    const { url } = payload;
    // Optimistic update
    await stateStore.setSave(url, true);
    try {
        const res = await ApiClient.saveArticle(payload);
        // Update state with ID from response
        if (res?.article_id) {
            await stateStore.setSave(url, true, res.article_id, {
                priority: payload.priority?.toString(),
                note: payload.note,
                title: payload.title
            });
        }
        return res;
    } catch (err) {
        // Revert
        await stateStore.setSave(url, false);
        throw err;
    }
}

interface UnsaveArticlePayload {
    url?: string;
    articleId?: string;
}

export async function handleUnsaveArticle(payload: UnsaveArticlePayload) {
    const { url, articleId } = payload;
    // Get ID from state if not provided
    const idToUse = articleId || (url ? stateStore.getSaveId(url) : undefined);

    if (url) await stateStore.setSave(url, false);

    try {
        if (idToUse) {
            const res = await ApiClient.updateArticle(idToUse, { is_saved: false }, "clipped");
            return res;
        } else {
            console.warn("Attempted to unsave article without ID", url);
            return { success: true };
        }
    } catch (err) {
        if (url) await stateStore.setSave(url, true, idToUse); // Revert
        throw err;
    }
}

interface UpdateArticlePayload {
    articleId: string;
    data: {
        priority?: number;
        user_note?: string;
        title?: string;
        [key: string]: any;
    };
    url?: string;
}

export async function handleUpdateArticle(payload: UpdateArticlePayload) {
    const { articleId, data } = payload;

    if (payload.url) {
        await stateStore.setSave(payload.url, true, articleId, {
            priority: data.priority?.toString(),
            note: data.user_note, // Map user_note to note
            title: data.title,
        });
    }

    return ApiClient.updateArticle(articleId, {
        ...data,
        priority: data.priority?.toString()
    }, "clipped");
}

interface CheckArticleSavedPayload {
    url: string;
}

export async function handleCheckArticleSaved(payload: CheckArticleSavedPayload) {
    // Use local state store first
    if (payload.url) {
        const state = stateStore.getSaveData(payload.url);
        // If we have state (saved OR explicitly unsaved), use it
        if (state) {
            return {
                saved: state.saved === true,
                is_saved: state.saved === true,
                article_id: state.id,
                priority: state.priority,
                note: state.note,
                title: state.title
            };
        }
    }
    const res = await ApiClient.checkArticleSaved(payload.url);
    if (res.is_saved && res.article_id) {
        await stateStore.setSave(payload.url, true, res.article_id, {
            priority: res.priority ? String(res.priority) : undefined,
            note: res.note || undefined,
            title: res.title || undefined
        });
    }
    return res;
}
