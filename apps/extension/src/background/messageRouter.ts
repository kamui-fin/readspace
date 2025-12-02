import browser from "webextension-polyfill";
import { supabase } from "./supabaseClient";
import { ExtensionMessage } from "../shared/types";
import { ApiClient } from "@readspace/shared";
import { pageCache } from "../lib/page-cache";

export async function handleMessage(msg: ExtensionMessage) {
    switch (msg.type) {
        case "login":
            return supabase.auth.signInWithPassword(msg.payload);

        case "logout":
            return supabase.auth.signOut();

        case "getSession":
            return (await browser.storage.local.get("session")).session;

        case "fetchFeeds":
            return ApiClient.getFeeds();

        // Article Actions
        case "saveArticle":
            return ApiClient.saveArticle(msg.payload);

        case "unsaveArticle":
            return ApiClient.updateArticle(msg.payload.articleId, { is_saved: false });

        case "updateArticle":
            return ApiClient.updateArticle(msg.payload.articleId, msg.payload.data);

        case "checkArticleSaved":
            return ApiClient.checkArticleSaved(msg.payload);

        case "getProfile":
            return ApiClient.getProfile();

        // Feed Actions
        case "createFeed":
            return ApiClient.createFeed(msg.payload);

        case "deleteFeed":
            return ApiClient.deleteFeed(msg.payload.feedId);

        // Folder Actions
        case "createFolder":
            return ApiClient.createFolder(msg.payload);

        case "updateFolder":
            return ApiClient.updateFolder(msg.payload.folderId, msg.payload.data);

        case "deleteFolder":
            return ApiClient.deleteFolder(msg.payload.folderId);

        case "config-changed":
            // Handled by listeners in supabaseClient and apiClient
            return true;

        case "getCachedPageByUrl":
            return pageCache.get(msg.payload);

        default:
            throw new Error(`Unknown message type: ${(msg as any).type}`);
    }
}
