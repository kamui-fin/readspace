export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export type Database = {
    // Allows to automatically instantiate createClient with right options
    // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
    __InternalSupabase: {
        PostgrestVersion: "12.2.3 (519615d)"
    }
    public: {
        Tables: {
            alembic_version: {
                Row: {
                    version_num: string
                }
                Insert: {
                    version_num: string
                }
                Update: {
                    version_num?: string
                }
                Relationships: []
            }
            article_contents: {
                Row: {
                    author: string | null
                    content: string | null
                    created_at: string | null
                    custom_metadata: Json | null
                    description: string | null
                    estimated_read_time_minutes: number | null
                    id: string
                    image_url: string | null
                    link: string
                    published_at: string | null
                    title: string | null
                    updated_at: string | null
                }
                Insert: {
                    author?: string | null
                    content?: string | null
                    created_at?: string | null
                    custom_metadata?: Json | null
                    description?: string | null
                    estimated_read_time_minutes?: number | null
                    id?: string
                    image_url?: string | null
                    link: string
                    published_at?: string | null
                    title?: string | null
                    updated_at?: string | null
                }
                Update: {
                    author?: string | null
                    content?: string | null
                    created_at?: string | null
                    custom_metadata?: Json | null
                    description?: string | null
                    estimated_read_time_minutes?: number | null
                    id?: string
                    image_url?: string | null
                    link?: string
                    published_at?: string | null
                    title?: string | null
                    updated_at?: string | null
                }
                Relationships: []
            }
            book_metadata: {
                Row: {
                    author: string | null
                    cover_url: string | null
                    created_at: string
                    description: string | null
                    epub_chapter_char_counts: number[] | null
                    epub_page_char_counts: number[] | null
                    file_size_bytes: number | null
                    file_url: string
                    format: Database["public"]["Enums"]["bookformat"]
                    id: string
                    num_pages: number | null
                    pdf_toc: Json | null
                    title: string
                }
                Insert: {
                    author?: string | null
                    cover_url?: string | null
                    created_at: string
                    description?: string | null
                    epub_chapter_char_counts?: number[] | null
                    epub_page_char_counts?: number[] | null
                    file_size_bytes?: number | null
                    file_url: string
                    format: Database["public"]["Enums"]["bookformat"]
                    id?: string
                    num_pages?: number | null
                    pdf_toc?: Json | null
                    title: string
                }
                Update: {
                    author?: string | null
                    cover_url?: string | null
                    created_at?: string
                    description?: string | null
                    epub_chapter_char_counts?: number[] | null
                    epub_page_char_counts?: number[] | null
                    file_size_bytes?: number | null
                    file_url?: string
                    format?: Database["public"]["Enums"]["bookformat"]
                    id?: string
                    num_pages?: number | null
                    pdf_toc?: Json | null
                    title?: string
                }
                Relationships: []
            }
            clipped_articles: {
                Row: {
                    content_id: string
                    created_at: string | null
                    id: string
                    is_favorite: boolean
                    is_read: boolean
                    is_read_later: boolean
                    note: string | null
                    priority: string
                    read_at: string | null
                    user_id: string
                }
                Insert: {
                    content_id: string
                    created_at?: string | null
                    id?: string
                    is_favorite: boolean
                    is_read: boolean
                    is_read_later: boolean
                    note?: string | null
                    priority: string
                    read_at?: string | null
                    user_id: string
                }
                Update: {
                    content_id?: string
                    created_at?: string | null
                    id?: string
                    is_favorite?: boolean
                    is_read?: boolean
                    is_read_later?: boolean
                    note?: string | null
                    priority?: string
                    read_at?: string | null
                    user_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "clipped_articles_content_id_fkey"
                        columns: ["content_id"]
                        isOneToOne: false
                        referencedRelation: "article_contents"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "clipped_articles_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
            feed_articles: {
                Row: {
                    content_id: string
                    created_at: string
                    feed_id: string
                    guid: string
                    id: string
                    updated_at: string
                }
                Insert: {
                    content_id: string
                    created_at?: string
                    feed_id: string
                    guid: string
                    id?: string
                    updated_at?: string
                }
                Update: {
                    content_id?: string
                    created_at?: string
                    feed_id?: string
                    guid?: string
                    id?: string
                    updated_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "feed_articles_content_id_fkey"
                        columns: ["content_id"]
                        isOneToOne: false
                        referencedRelation: "article_contents"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "feed_articles_feed_id_fkey"
                        columns: ["feed_id"]
                        isOneToOne: false
                        referencedRelation: "feeds"
                        referencedColumns: ["id"]
                    },
                ]
            }
            feed_subscriptions: {
                Row: {
                    created_at: string
                    custom_title: string | null
                    feed_id: string
                    folder_id: string
                    id: string
                    is_favorite: boolean
                    updated_at: string
                    user_id: string
                }
                Insert: {
                    created_at?: string
                    custom_title?: string | null
                    feed_id: string
                    folder_id: string
                    id?: string
                    is_favorite: boolean
                    updated_at?: string
                    user_id: string
                }
                Update: {
                    created_at?: string
                    custom_title?: string | null
                    feed_id?: string
                    folder_id?: string
                    id?: string
                    is_favorite?: boolean
                    updated_at?: string
                    user_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "feed_subscriptions_feed_id_fkey"
                        columns: ["feed_id"]
                        isOneToOne: false
                        referencedRelation: "feeds"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "feed_subscriptions_folder_id_fkey"
                        columns: ["folder_id"]
                        isOneToOne: false
                        referencedRelation: "folders"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "feed_subscriptions_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
            feeds: {
                Row: {
                    created_at: string
                    description: string | null
                    embedding: string | null
                    etag_header: string | null
                    fetch_error_count: number
                    id: string
                    image_url: string | null
                    language: string | null
                    last_article_published_at: string | null
                    last_error_message: string | null
                    last_fetched_at: string | null
                    last_modified_header: string | null
                    link: string | null
                    popularity_score: number | null
                    skip_days: string[] | null
                    skip_hours: number[] | null
                    subscriber_count: number
                    tags: string[] | null
                    title: string | null
                    top_level_category:
                        | Database["public"]["Enums"]["feedcategory"]
                        | null
                    tsv_desc_tags: unknown | null
                    tsv_title_link: unknown | null
                    ttl: number | null
                    updated_at: string
                    url: string
                }
                Insert: {
                    created_at?: string
                    description?: string | null
                    embedding?: string | null
                    etag_header?: string | null
                    fetch_error_count?: number
                    id?: string
                    image_url?: string | null
                    language?: string | null
                    last_article_published_at?: string | null
                    last_error_message?: string | null
                    last_fetched_at?: string | null
                    last_modified_header?: string | null
                    link?: string | null
                    popularity_score?: number | null
                    skip_days?: string[] | null
                    skip_hours?: number[] | null
                    subscriber_count?: number
                    tags?: string[] | null
                    title?: string | null
                    top_level_category?:
                        | Database["public"]["Enums"]["feedcategory"]
                        | null
                    tsv_desc_tags?: unknown | null
                    tsv_title_link?: unknown | null
                    ttl?: number | null
                    updated_at?: string
                    url: string
                }
                Update: {
                    created_at?: string
                    description?: string | null
                    embedding?: string | null
                    etag_header?: string | null
                    fetch_error_count?: number
                    id?: string
                    image_url?: string | null
                    language?: string | null
                    last_article_published_at?: string | null
                    last_error_message?: string | null
                    last_fetched_at?: string | null
                    last_modified_header?: string | null
                    link?: string | null
                    popularity_score?: number | null
                    skip_days?: string[] | null
                    skip_hours?: number[] | null
                    subscriber_count?: number
                    tags?: string[] | null
                    title?: string | null
                    top_level_category?:
                        | Database["public"]["Enums"]["feedcategory"]
                        | null
                    tsv_desc_tags?: unknown | null
                    tsv_title_link?: unknown | null
                    ttl?: number | null
                    updated_at?: string
                    url?: string
                }
                Relationships: []
            }
            folders: {
                Row: {
                    created_at: string | null
                    id: string
                    name: string
                    updated_at: string | null
                    user_id: string
                }
                Insert: {
                    created_at?: string | null
                    id?: string
                    name: string
                    updated_at?: string | null
                    user_id: string
                }
                Update: {
                    created_at?: string | null
                    id?: string
                    name?: string
                    updated_at?: string | null
                    user_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "folders_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
            highlights: {
                Row: {
                    chapter_href: string | null
                    chapter_idx: number | null
                    chapter_title: string | null
                    color: Database["public"]["Enums"]["highlightcolor"]
                    html_range: Json | null
                    id: string
                    note: string | null
                    original_text: string
                    page: number | null
                    pdf_rect_position: Json | null
                    user_book_lib_id: string
                }
                Insert: {
                    chapter_href?: string | null
                    chapter_idx?: number | null
                    chapter_title?: string | null
                    color: Database["public"]["Enums"]["highlightcolor"]
                    html_range?: Json | null
                    id?: string
                    note?: string | null
                    original_text: string
                    page?: number | null
                    pdf_rect_position?: Json | null
                    user_book_lib_id: string
                }
                Update: {
                    chapter_href?: string | null
                    chapter_idx?: number | null
                    chapter_title?: string | null
                    color?: Database["public"]["Enums"]["highlightcolor"]
                    html_range?: Json | null
                    id?: string
                    note?: string | null
                    original_text?: string
                    page?: number | null
                    pdf_rect_position?: Json | null
                    user_book_lib_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "highlights_user_book_lib_id_fkey"
                        columns: ["user_book_lib_id"]
                        isOneToOne: false
                        referencedRelation: "user_book_library"
                        referencedColumns: ["id"]
                    },
                ]
            }
            profiles: {
                Row: {
                    created_at: string
                    email: string
                    id: string
                    role: string
                    updated_at: string
                }
                Insert: {
                    created_at: string
                    email: string
                    id: string
                    role?: string
                    updated_at: string
                }
                Update: {
                    created_at?: string
                    email?: string
                    id?: string
                    role?: string
                    updated_at?: string
                }
                Relationships: []
            }
            user_article_states: {
                Row: {
                    article_id: string
                    created_at: string
                    id: string
                    is_favorite: boolean
                    is_read: boolean
                    is_read_later: boolean
                    read_at: string | null
                    updated_at: string
                    user_id: string
                    user_note: string | null
                    user_tags: string[] | null
                }
                Insert: {
                    article_id: string
                    created_at?: string
                    id?: string
                    is_favorite: boolean
                    is_read: boolean
                    is_read_later: boolean
                    read_at?: string | null
                    updated_at?: string
                    user_id: string
                    user_note?: string | null
                    user_tags?: string[] | null
                }
                Update: {
                    article_id?: string
                    created_at?: string
                    id?: string
                    is_favorite?: boolean
                    is_read?: boolean
                    is_read_later?: boolean
                    read_at?: string | null
                    updated_at?: string
                    user_id?: string
                    user_note?: string | null
                    user_tags?: string[] | null
                }
                Relationships: [
                    {
                        foreignKeyName: "user_article_states_article_id_fkey"
                        columns: ["article_id"]
                        isOneToOne: false
                        referencedRelation: "feed_articles"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "user_article_states_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
            user_book_library: {
                Row: {
                    book_metadata_id: string
                    date_added: string
                    epub_progress: Json | null
                    id: string
                    pdf_current_page: number | null
                    user_id: string
                }
                Insert: {
                    book_metadata_id: string
                    date_added: string
                    epub_progress?: Json | null
                    id?: string
                    pdf_current_page?: number | null
                    user_id: string
                }
                Update: {
                    book_metadata_id?: string
                    date_added?: string
                    epub_progress?: Json | null
                    id?: string
                    pdf_current_page?: number | null
                    user_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "user_book_library_book_metadata_id_fkey"
                        columns: ["book_metadata_id"]
                        isOneToOne: false
                        referencedRelation: "book_metadata"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "user_book_library_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            binary_quantize: {
                Args: { "": string } | { "": unknown }
                Returns: unknown
            }
            halfvec_avg: {
                Args: { "": number[] }
                Returns: unknown
            }
            halfvec_out: {
                Args: { "": unknown }
                Returns: unknown
            }
            halfvec_send: {
                Args: { "": unknown }
                Returns: string
            }
            halfvec_typmod_in: {
                Args: { "": unknown[] }
                Returns: number
            }
            hnsw_bit_support: {
                Args: { "": unknown }
                Returns: unknown
            }
            hnsw_halfvec_support: {
                Args: { "": unknown }
                Returns: unknown
            }
            hnsw_sparsevec_support: {
                Args: { "": unknown }
                Returns: unknown
            }
            hnswhandler: {
                Args: { "": unknown }
                Returns: unknown
            }
            ivfflat_bit_support: {
                Args: { "": unknown }
                Returns: unknown
            }
            ivfflat_halfvec_support: {
                Args: { "": unknown }
                Returns: unknown
            }
            ivfflathandler: {
                Args: { "": unknown }
                Returns: unknown
            }
            l2_norm: {
                Args: { "": unknown } | { "": unknown }
                Returns: number
            }
            l2_normalize: {
                Args: { "": string } | { "": unknown } | { "": unknown }
                Returns: string
            }
            sparsevec_out: {
                Args: { "": unknown }
                Returns: unknown
            }
            sparsevec_send: {
                Args: { "": unknown }
                Returns: string
            }
            sparsevec_typmod_in: {
                Args: { "": unknown[] }
                Returns: number
            }
            vector_avg: {
                Args: { "": number[] }
                Returns: string
            }
            vector_dims: {
                Args: { "": string } | { "": unknown }
                Returns: number
            }
            vector_norm: {
                Args: { "": string }
                Returns: number
            }
            vector_out: {
                Args: { "": string }
                Returns: unknown
            }
            vector_send: {
                Args: { "": string }
                Returns: string
            }
            vector_typmod_in: {
                Args: { "": unknown[] }
                Returns: number
            }
        }
        Enums: {
            bookformat: "EPUB" | "PDF"
            feedcategory:
                | "TECHNOLOGY_PROGRAMMING"
                | "CULTURE_ARTS"
                | "LIFESTYLE_PERSONAL"
                | "MISCELLANEOUS"
                | "DESIGN_CREATIVITY"
                | "SCIENCE_RESEARCH"
                | "NEWS_POLITICS"
                | "GAMING_ENTERTAINMENT"
                | "BUSINESS_FINANCE"
                | "ARTIFICIAL_INTELLIGENCE"
                | "SECURITY_PRIVACY"
                | "EDUCATION_LEARNING"
            highlightcolor: "YELLOW" | "GREEN" | "BLUE"
        }
        CompositeTypes: {
            [_ in never]: never
        }
    }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
    DefaultSchemaTableNameOrOptions extends
        | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
        | { schema: keyof DatabaseWithoutInternals },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
    }
        ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
              DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
        : never = never,
> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
}
    ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
          DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
          Row: infer R
      }
        ? R
        : never
    : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
            DefaultSchema["Views"])
      ? (DefaultSchema["Tables"] &
            DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
            Row: infer R
        }
          ? R
          : never
      : never

export type TablesInsert<
    DefaultSchemaTableNameOrOptions extends
        | keyof DefaultSchema["Tables"]
        | { schema: keyof DatabaseWithoutInternals },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
    }
        ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
        : never = never,
> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
}
    ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
          Insert: infer I
      }
        ? I
        : never
    : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
      ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
            Insert: infer I
        }
          ? I
          : never
      : never

export type TablesUpdate<
    DefaultSchemaTableNameOrOptions extends
        | keyof DefaultSchema["Tables"]
        | { schema: keyof DatabaseWithoutInternals },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
    }
        ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
        : never = never,
> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
}
    ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
          Update: infer U
      }
        ? U
        : never
    : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
      ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
            Update: infer U
        }
          ? U
          : never
      : never

export type Enums<
    DefaultSchemaEnumNameOrOptions extends
        | keyof DefaultSchema["Enums"]
        | { schema: keyof DatabaseWithoutInternals },
    EnumName extends DefaultSchemaEnumNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
    }
        ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
        : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
}
    ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
    : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
      ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
      : never

export type CompositeTypes<
    PublicCompositeTypeNameOrOptions extends
        | keyof DefaultSchema["CompositeTypes"]
        | { schema: keyof DatabaseWithoutInternals },
    CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
    }
        ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
        : never = never,
> = PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
}
    ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
    : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
      ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
      : never

export const Constants = {
    public: {
        Enums: {
            bookformat: ["EPUB", "PDF"],
            feedcategory: [
                "TECHNOLOGY_PROGRAMMING",
                "CULTURE_ARTS",
                "LIFESTYLE_PERSONAL",
                "MISCELLANEOUS",
                "DESIGN_CREATIVITY",
                "SCIENCE_RESEARCH",
                "NEWS_POLITICS",
                "GAMING_ENTERTAINMENT",
                "BUSINESS_FINANCE",
                "ARTIFICIAL_INTELLIGENCE",
                "SECURITY_PRIVACY",
                "EDUCATION_LEARNING",
            ],
            highlightcolor: ["YELLOW", "GREEN", "BLUE"],
        },
    },
} as const
