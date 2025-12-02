export interface ExtensionSettings {
    readspace_url: string
    supabase_url: string
    supabase_anon_key: string
    google_client_id?: string
    default_folder_id?: string
    auto_save: boolean
    show_reading_time: boolean
    theme: 'light' | 'dark' | 'system'
}

export interface DetectedFeed {
    url: string
    type: 'rss' | 'atom' | 'json' | 'unknown'
    title?: string
    source: 'link-tag' | 'anchor-tag' | 'guess'
    score: number
}

export interface CachedPageContent {
    content?: string
    title?: string
    description?: string
    author?: string
    published_at?: string
    image_url?: string
    estimated_read_time?: number
}

export interface CachedPageMetadata {
    feeds?: DetectedFeed[]
    title?: string
    description?: string
    author?: string
    published_at?: string
    image_url?: string
    favicon?: string
    canonical_url?: string
}

export interface MessageRequest {
    action: string
    type?: string
    email?: string
    password?: string
    url?: string
    [key: string]: unknown
}
