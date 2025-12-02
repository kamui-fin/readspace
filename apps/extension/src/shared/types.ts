import { Session } from '@supabase/supabase-js';

export type MessageType =
    | 'login'
    | 'logout'
    | 'getSession'
    | 'auth-changed'
    | 'fetchFeeds'
    | 'saveArticle'
    | 'unsaveArticle'
    | 'updateArticle'
    | 'checkArticleSaved'
    | 'getProfile'
    | 'createFeed'
    | 'deleteFeed'
    | 'createFolder'
    | 'updateFolder'
    | 'deleteFolder'
    | 'config-changed'
    | 'getCachedPageByUrl'
    | 'extractMetadata'
    | 'extractContent'
    | 'discoverFeeds';

export interface ExtensionMessage<T = any> {
    type: MessageType;
    payload?: T;
}

export interface MessageResponse<T = any> {
    data: T | null;
    error: string | null;
}

export type { Session };
