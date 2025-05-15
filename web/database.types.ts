export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export type Database = {
    public: {
        Tables: {
            books: {
                Row: {
                    author: string | null
                    cover_url: string | null
                    date_added: string | null
                    description: string | null
                    epub_chapter_char_counts: number[] | null
                    epub_page_char_counts: number[] | null
                    epub_progress: Json | null
                    file_size_bytes: number | null
                    file_url: string | null
                    goals: string | null
                    id: string
                    identifier: string | null
                    language: string | null
                    last_recall_page: number | null
                    num_pages: number | null
                    pdf_page: number | null
                    pdf_toc: Json | null
                    pubdate: string | null
                    publisher: string | null
                    rag_enabled: boolean
                    title: string
                    type: string | null
                    user_id: string | null
                }
                Insert: {
                    author?: string | null
                    cover_url?: string | null
                    date_added?: string | null
                    description?: string | null
                    epub_chapter_char_counts?: number[] | null
                    epub_page_char_counts?: number[] | null
                    epub_progress?: Json | null
                    file_size_bytes?: number | null
                    file_url?: string | null
                    goals?: string | null
                    id: string
                    identifier?: string | null
                    language?: string | null
                    last_recall_page?: number | null
                    num_pages?: number | null
                    pdf_page?: number | null
                    pdf_toc?: Json | null
                    pubdate?: string | null
                    publisher?: string | null
                    rag_enabled?: boolean
                    title: string
                    type?: string | null
                    user_id?: string | null
                }
                Update: {
                    author?: string | null
                    cover_url?: string | null
                    date_added?: string | null
                    description?: string | null
                    epub_chapter_char_counts?: number[] | null
                    epub_page_char_counts?: number[] | null
                    epub_progress?: Json | null
                    file_size_bytes?: number | null
                    file_url?: string | null
                    goals?: string | null
                    id?: string
                    identifier?: string | null
                    language?: string | null
                    last_recall_page?: number | null
                    num_pages?: number | null
                    pdf_page?: number | null
                    pdf_toc?: Json | null
                    pubdate?: string | null
                    publisher?: string | null
                    rag_enabled?: boolean
                    title?: string
                    type?: string | null
                    user_id?: string | null
                }
                Relationships: []
            }
            card_contents: {
                Row: {
                    answer: string
                    card_id: string
                    created_at: string
                    deleted: boolean
                    extend: Json | null
                    id: string
                    question: string
                    source: string
                    sourceId: string | null
                }
                Insert: {
                    answer?: string
                    card_id: string
                    created_at?: string
                    deleted?: boolean
                    extend?: Json | null
                    id: string
                    question?: string
                    source?: string
                    sourceId?: string | null
                }
                Update: {
                    answer?: string
                    card_id?: string
                    created_at?: string
                    deleted?: boolean
                    extend?: Json | null
                    id?: string
                    question?: string
                    source?: string
                    sourceId?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "card_contents_card_id_cards_id_fk"
                        columns: ["card_id"]
                        isOneToOne: false
                        referencedRelation: "cards"
                        referencedColumns: ["id"]
                    },
                ]
            }
            cards: {
                Row: {
                    created_at: string
                    deleted: boolean
                    difficulty: number
                    due: string
                    elapsed_days: number
                    id: string
                    lapses: number
                    last_review: string | null
                    reps: number
                    scheduled_days: number
                    stability: number
                    state: Database["public"]["Enums"]["card_state"]
                    suspended: string
                    user_id: string
                }
                Insert: {
                    created_at?: string
                    deleted?: boolean
                    difficulty: number
                    due?: string
                    elapsed_days: number
                    id: string
                    lapses: number
                    last_review?: string | null
                    reps: number
                    scheduled_days: number
                    stability: number
                    state: Database["public"]["Enums"]["card_state"]
                    suspended?: string
                    user_id: string
                }
                Update: {
                    created_at?: string
                    deleted?: boolean
                    difficulty?: number
                    due?: string
                    elapsed_days?: number
                    id?: string
                    lapses?: number
                    last_review?: string | null
                    reps?: number
                    scheduled_days?: number
                    stability?: number
                    state?: Database["public"]["Enums"]["card_state"]
                    suspended?: string
                    user_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "cards_user_id_profiles_id_fk"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
            cards_to_decks: {
                Row: {
                    card_id: string
                    created_at: string
                    deck_id: string
                }
                Insert: {
                    card_id: string
                    created_at?: string
                    deck_id: string
                }
                Update: {
                    card_id?: string
                    created_at?: string
                    deck_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "cards_to_decks_card_id_cards_id_fk"
                        columns: ["card_id"]
                        isOneToOne: false
                        referencedRelation: "cards"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "cards_to_decks_deck_id_decks_id_fk"
                        columns: ["deck_id"]
                        isOneToOne: false
                        referencedRelation: "decks"
                        referencedColumns: ["id"]
                    },
                ]
            }
            decks: {
                Row: {
                    created_at: string
                    deleted: boolean
                    description: string
                    id: string
                    name: string
                    user_id: string
                }
                Insert: {
                    created_at?: string
                    deleted?: boolean
                    description?: string
                    id: string
                    name: string
                    user_id: string
                }
                Update: {
                    created_at?: string
                    deleted?: boolean
                    description?: string
                    id?: string
                    name?: string
                    user_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "decks_user_id_profiles_id_fk"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
            feedback: {
                Row: {
                    allow_follow_up: boolean
                    created_at: string
                    description: string
                    feedback_type: string
                    id: string
                    user_id: string | null
                }
                Insert: {
                    allow_follow_up?: boolean
                    created_at?: string
                    description: string
                    feedback_type: string
                    id?: string
                    user_id?: string | null
                }
                Update: {
                    allow_follow_up?: boolean
                    created_at?: string
                    description?: string
                    feedback_type?: string
                    id?: string
                    user_id?: string | null
                }
                Relationships: []
            }
            highlights: {
                Row: {
                    book_id: string
                    color: string
                    created_at: string | null
                    epub_chapter_href: string | null
                    epub_chapter_idx: number | null
                    epub_chapter_title: string | null
                    epub_est_page: number | null
                    epub_range: Json | null
                    id: string
                    note: string | null
                    pdf_rect_position: Json | null
                    text: string
                }
                Insert: {
                    book_id: string
                    color: string
                    created_at?: string | null
                    epub_chapter_href?: string | null
                    epub_chapter_idx?: number | null
                    epub_chapter_title?: string | null
                    epub_est_page?: number | null
                    epub_range?: Json | null
                    id?: string
                    note?: string | null
                    pdf_rect_position?: Json | null
                    text: string
                }
                Update: {
                    book_id?: string
                    color?: string
                    created_at?: string | null
                    epub_chapter_href?: string | null
                    epub_chapter_idx?: number | null
                    epub_chapter_title?: string | null
                    epub_est_page?: number | null
                    epub_range?: Json | null
                    id?: string
                    note?: string | null
                    pdf_rect_position?: Json | null
                    text?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "highlights_book_id_fkey"
                        columns: ["book_id"]
                        isOneToOne: false
                        referencedRelation: "books"
                        referencedColumns: ["id"]
                    },
                ]
            }
            profiles: {
                Row: {
                    id: string
                    reader_onboarded: boolean | null
                    recall_onboarded: boolean | null
                    role: Database["public"]["Enums"]["user_role"]
                    srs_onboarded: boolean | null
                    username: string | null
                    welcome_onboarded: boolean | null
                }
                Insert: {
                    id: string
                    reader_onboarded?: boolean | null
                    recall_onboarded?: boolean | null
                    role?: Database["public"]["Enums"]["user_role"]
                    srs_onboarded?: boolean | null
                    username?: string | null
                    welcome_onboarded?: boolean | null
                }
                Update: {
                    id?: string
                    reader_onboarded?: boolean | null
                    recall_onboarded?: boolean | null
                    role?: Database["public"]["Enums"]["user_role"]
                    srs_onboarded?: boolean | null
                    username?: string | null
                    welcome_onboarded?: boolean | null
                }
                Relationships: []
            }
            review_logs: {
                Row: {
                    card_id: string
                    created_at: string
                    deleted: boolean
                    difficulty: number
                    due: string
                    duration: number
                    elapsed_days: number
                    grade: Database["public"]["Enums"]["card_rating"]
                    id: string
                    last_elapsed_days: number
                    review: string
                    scheduled_days: number
                    stability: number
                    state: Database["public"]["Enums"]["card_state"]
                }
                Insert: {
                    card_id: string
                    created_at?: string
                    deleted?: boolean
                    difficulty: number
                    due: string
                    duration?: number
                    elapsed_days: number
                    grade: Database["public"]["Enums"]["card_rating"]
                    id: string
                    last_elapsed_days: number
                    review: string
                    scheduled_days: number
                    stability: number
                    state: Database["public"]["Enums"]["card_state"]
                }
                Update: {
                    card_id?: string
                    created_at?: string
                    deleted?: boolean
                    difficulty?: number
                    due?: string
                    duration?: number
                    elapsed_days?: number
                    grade?: Database["public"]["Enums"]["card_rating"]
                    id?: string
                    last_elapsed_days?: number
                    review?: string
                    scheduled_days?: number
                    stability?: number
                    state?: Database["public"]["Enums"]["card_state"]
                }
                Relationships: [
                    {
                        foreignKeyName: "review_logs_card_id_cards_id_fk"
                        columns: ["card_id"]
                        isOneToOne: false
                        referencedRelation: "cards"
                        referencedColumns: ["id"]
                    },
                ]
            }
            user_media: {
                Row: {
                    created_at: string
                    id: string
                    url: string
                    userId: string
                }
                Insert: {
                    created_at?: string
                    id: string
                    url: string
                    userId: string
                }
                Update: {
                    created_at?: string
                    id?: string
                    url?: string
                    userId?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "user_media_userId_profiles_id_fk"
                        columns: ["userId"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
            user_usage_limits: {
                Row: {
                    images_sent_today: number
                    last_reset_daily: string
                    last_reset_monthly: string
                    rag_pages_current_month: number
                    reader_actions_today: number
                    recall_sessions_today: number
                    storage_used_bytes: number
                    user_id: string
                }
                Insert: {
                    images_sent_today?: number
                    last_reset_daily?: string
                    last_reset_monthly?: string
                    rag_pages_current_month?: number
                    reader_actions_today?: number
                    recall_sessions_today?: number
                    storage_used_bytes?: number
                    user_id: string
                }
                Update: {
                    images_sent_today?: number
                    last_reset_daily?: string
                    last_reset_monthly?: string
                    rag_pages_current_month?: number
                    reader_actions_today?: number
                    recall_sessions_today?: number
                    storage_used_bytes?: number
                    user_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "user_usage_limits_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: true
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
            binary_quantize:
                | {
                      Args: {
                          "": string
                      }
                      Returns: unknown
                  }
                | {
                      Args: {
                          "": unknown
                      }
                      Returns: unknown
                  }
            halfvec_avg: {
                Args: {
                    "": number[]
                }
                Returns: unknown
            }
            halfvec_out: {
                Args: {
                    "": unknown
                }
                Returns: unknown
            }
            halfvec_send: {
                Args: {
                    "": unknown
                }
                Returns: string
            }
            halfvec_typmod_in: {
                Args: {
                    "": unknown[]
                }
                Returns: number
            }
            hnsw_bit_support: {
                Args: {
                    "": unknown
                }
                Returns: unknown
            }
            hnsw_halfvec_support: {
                Args: {
                    "": unknown
                }
                Returns: unknown
            }
            hnsw_sparsevec_support: {
                Args: {
                    "": unknown
                }
                Returns: unknown
            }
            hnswhandler: {
                Args: {
                    "": unknown
                }
                Returns: unknown
            }
            increment_usage: {
                Args: {
                    p_user_id: string
                    p_storage_delta?: number
                    p_rag_delta?: number
                    p_reader_actions_delta?: number
                    p_recall_sessions_delta?: number
                    p_images_delta?: number
                }
                Returns: undefined
            }
            ivfflat_bit_support: {
                Args: {
                    "": unknown
                }
                Returns: unknown
            }
            ivfflat_halfvec_support: {
                Args: {
                    "": unknown
                }
                Returns: unknown
            }
            ivfflathandler: {
                Args: {
                    "": unknown
                }
                Returns: unknown
            }
            l2_norm:
                | {
                      Args: {
                          "": unknown
                      }
                      Returns: number
                  }
                | {
                      Args: {
                          "": unknown
                      }
                      Returns: number
                  }
            l2_normalize:
                | {
                      Args: {
                          "": string
                      }
                      Returns: string
                  }
                | {
                      Args: {
                          "": unknown
                      }
                      Returns: unknown
                  }
                | {
                      Args: {
                          "": unknown
                      }
                      Returns: unknown
                  }
            match_vectors: {
                Args: {
                    query_embedding: string
                    match_count: number
                    filter?: Json
                }
                Returns: {
                    id: string
                    similarity: number
                    metadata: Json
                }[]
            }
            sparsevec_out: {
                Args: {
                    "": unknown
                }
                Returns: unknown
            }
            sparsevec_send: {
                Args: {
                    "": unknown
                }
                Returns: string
            }
            sparsevec_typmod_in: {
                Args: {
                    "": unknown[]
                }
                Returns: number
            }
            vector_avg: {
                Args: {
                    "": number[]
                }
                Returns: string
            }
            vector_dims:
                | {
                      Args: {
                          "": string
                      }
                      Returns: number
                  }
                | {
                      Args: {
                          "": unknown
                      }
                      Returns: number
                  }
            vector_norm: {
                Args: {
                    "": string
                }
                Returns: number
            }
            vector_out: {
                Args: {
                    "": string
                }
                Returns: unknown
            }
            vector_send: {
                Args: {
                    "": string
                }
                Returns: string
            }
            vector_typmod_in: {
                Args: {
                    "": unknown[]
                }
                Returns: number
            }
        }
        Enums: {
            card_rating: "Manual" | "Again" | "Hard" | "Good" | "Easy"
            card_state: "New" | "Learning" | "Review" | "Relearning"
            user_role: "basic" | "premium" | "admin"
        }
        CompositeTypes: {
            [_ in never]: never
        }
    }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
    DefaultSchemaTableNameOrOptions extends
        | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
        | { schema: keyof Database },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof Database
    }
        ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
              Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
        : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
    ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
          Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
        | { schema: keyof Database },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof Database
    }
        ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
        : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
    ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
        | { schema: keyof Database },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof Database
    }
        ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
        : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
    ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
        | { schema: keyof Database },
    EnumName extends DefaultSchemaEnumNameOrOptions extends {
        schema: keyof Database
    }
        ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
        : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
    ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
    : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
      ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
      : never

export type CompositeTypes<
    PublicCompositeTypeNameOrOptions extends
        | keyof DefaultSchema["CompositeTypes"]
        | { schema: keyof Database },
    CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
        schema: keyof Database
    }
        ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
        : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
    ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
    : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
      ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
      : never

export const Constants = {
    public: {
        Enums: {
            card_rating: ["Manual", "Again", "Hard", "Good", "Easy"],
            card_state: ["New", "Learning", "Review", "Relearning"],
            user_role: ["basic", "premium", "admin"],
        },
    },
} as const
