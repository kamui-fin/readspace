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
            book_metadata: {
                Row: {
                    author: string | null
                    cover_url: string | null
                    created_at: string
                    description: string | null
                    epub_chapter_char_counts: number[] | null
                    epub_page_char_counts: number[] | null
                    file_size_bytes: number | null
                    file_url: string | null
                    format: Database["public"]["Enums"]["bookformat"]
                    id: string
                    num_pages: number | null
                    pdf_toc: Json | null
                    title: string
                    updated_at: string
                }
                Insert: {
                    author?: string | null
                    cover_url?: string | null
                    created_at: string
                    description?: string | null
                    epub_chapter_char_counts?: number[] | null
                    epub_page_char_counts?: number[] | null
                    file_size_bytes?: number | null
                    file_url?: string | null
                    format: Database["public"]["Enums"]["bookformat"]
                    id?: string
                    num_pages?: number | null
                    pdf_toc?: Json | null
                    title: string
                    updated_at: string
                }
                Update: {
                    author?: string | null
                    cover_url?: string | null
                    created_at?: string
                    description?: string | null
                    epub_chapter_char_counts?: number[] | null
                    epub_page_char_counts?: number[] | null
                    file_size_bytes?: number | null
                    file_url?: string | null
                    format?: Database["public"]["Enums"]["bookformat"]
                    id?: string
                    num_pages?: number | null
                    pdf_toc?: Json | null
                    title?: string
                    updated_at?: string
                }
                Relationships: []
            }
            feedback: {
                Row: {
                    id: string
                    feedback_type: string
                    description: string
                    allow_follow_up: boolean
                    user_id: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    feedback_type: string
                    description: string
                    allow_follow_up: boolean
                    user_id?: string | null
                    created_at: string
                }
                Update: {
                    id?: string
                    feedback_type?: string
                    description?: string
                    allow_follow_up?: boolean
                    user_id?: string | null
                    created_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "feedback_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
            highlight_locations: {
                Row: {
                    chapter_href: string | null
                    chapter_idx: number | null
                    chapter_title: string | null
                    created_at: string
                    highlight_id: string
                    html_range: Json | null
                    id: string
                    page: number | null
                    pdf_rect_position: Json | null
                }
                Insert: {
                    chapter_href?: string | null
                    chapter_idx?: number | null
                    chapter_title?: string | null
                    created_at: string
                    highlight_id: string
                    html_range?: Json | null
                    id?: string
                    page?: number | null
                    pdf_rect_position?: Json | null
                }
                Update: {
                    chapter_href?: string | null
                    chapter_idx?: number | null
                    chapter_title?: string | null
                    created_at?: string
                    highlight_id?: string
                    html_range?: Json | null
                    id?: string
                    page?: number | null
                    pdf_rect_position?: Json | null
                }
                Relationships: [
                    {
                        foreignKeyName: "highlight_locations_highlight_id_fkey"
                        columns: ["highlight_id"]
                        isOneToOne: false
                        referencedRelation: "highlights"
                        referencedColumns: ["id"]
                    },
                ]
            }
            highlights: {
                Row: {
                    color: Database["public"]["Enums"]["highlightcolor"]
                    created_at: string
                    id: string
                    note: string | null
                    original_text: string
                    updated_at: string
                    user_book_lib_id: string
                }
                Insert: {
                    color: Database["public"]["Enums"]["highlightcolor"]
                    created_at: string
                    id?: string
                    note?: string | null
                    original_text: string
                    updated_at: string
                    user_book_lib_id: string
                }
                Update: {
                    color?: Database["public"]["Enums"]["highlightcolor"]
                    created_at?: string
                    id?: string
                    note?: string | null
                    original_text?: string
                    updated_at?: string
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
                    updated_at: string
                }
                Insert: {
                    created_at: string
                    email: string
                    id: string
                    updated_at: string
                }
                Update: {
                    created_at?: string
                    email?: string
                    id?: string
                    updated_at?: string
                }
                Relationships: []
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
                ]
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            [_ in never]: never
        }
        Enums: {
            bookformat: "epub" | "pdf"
            highlightcolor: "yellow" | "green" | "blue"
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
            bookformat: ["epub", "pdf"],
            highlightcolor: ["yellow", "green", "blue"],
        },
    },
} as const
