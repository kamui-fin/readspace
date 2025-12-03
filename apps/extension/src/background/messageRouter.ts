import browser from "webextension-polyfill";
import { supabase } from "./supabaseClient";
import { ExtensionMessage } from "../shared/types";
import { ApiClient } from "@readspace/shared";
import { pageCache } from "../lib/page-cache";
import { stateStore } from "./state-store";
import * as AuthHandlers from "./handlers/auth";
import * as ArticleHandlers from "./handlers/articles";
import * as FeedHandlers from "./handlers/feeds";

export async function handleMessage(msg: ExtensionMessage) {
    // Ensure state store is initialized
    await stateStore.init();

    switch (msg.type) {
        case "login":
            return supabase.auth.signInWithPassword(msg.payload);

        case "logout":
            return supabase.auth.signOut();

        case "getSession":
            return (await browser.storage.local.get("session")).session;

        case "fetchFolders":
            return ApiClient.listFolders();

        // Article Actions
        case "saveArticle":
            return ArticleHandlers.handleSaveArticle(msg.payload);

        case "unsaveArticle":
            return ArticleHandlers.handleUnsaveArticle(msg.payload);

        case "updateArticle":
            return ArticleHandlers.handleUpdateArticle(msg.payload);

        case "checkArticleSaved":
            return ArticleHandlers.handleCheckArticleSaved(msg.payload);

        case "checkFeedFollowed":
            return FeedHandlers.handleCheckFeedFollowed(msg.payload);

        case "follow":
            return FeedHandlers.handleFollow(msg.payload);

        case "unfollow":
            return FeedHandlers.handleUnfollow(msg.payload);

        case "getProfile":
            return ApiClient.getProfile();

        // Feed Actions
        case "createFeed":
            return FeedHandlers.handleCreateFeed(msg.payload);

        case "deleteFeed":
            return FeedHandlers.handleDeleteFeed(msg.payload);

        case "startGoogleOAuth":
            return AuthHandlers.startGoogleOAuth();

        case "getCachedPageByUrl":
            return pageCache.get(msg.payload);

        default:
            throw new Error(`Unknown message type: ${(msg as any).type}`);
    }
}

