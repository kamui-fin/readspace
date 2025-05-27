export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          operationName?: string
          query?: string
          variables?: Json
          extensions?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
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
      articles: {
        Row: {
          content: string | null
          created_at: string | null
          custom_metadata: Json | null
          description: string | null
          estimated_read_time_minutes: number | null
          feed_id: string
          guid: string
          id: string
          image_url: string | null
          is_favorite: boolean
          is_read: boolean
          is_read_later: boolean
          link: string
          published_at: string | null
          read_at: string | null
          title: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          custom_metadata?: Json | null
          description?: string | null
          estimated_read_time_minutes?: number | null
          feed_id: string
          guid: string
          id: string
          image_url?: string | null
          is_favorite: boolean
          is_read: boolean
          is_read_later: boolean
          link: string
          published_at?: string | null
          read_at?: string | null
          title?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string | null
          custom_metadata?: Json | null
          description?: string | null
          estimated_read_time_minutes?: number | null
          feed_id?: string
          guid?: string
          id?: string
          image_url?: string | null
          is_favorite?: boolean
          is_read?: boolean
          is_read_later?: boolean
          link?: string
          published_at?: string | null
          read_at?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "articles_feed_id_fkey"
            columns: ["feed_id"]
            isOneToOne: false
            referencedRelation: "feeds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "articles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          id: string
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
          file_url?: string | null
          format?: Database["public"]["Enums"]["bookformat"]
          id?: string
          num_pages?: number | null
          pdf_toc?: Json | null
          title?: string
        }
        Relationships: []
      }
      feed_tag_association: {
        Row: {
          feed_id: string
          tag_id: string
        }
        Insert: {
          feed_id: string
          tag_id: string
        }
        Update: {
          feed_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_tag_association_feed_id_fkey"
            columns: ["feed_id"]
            isOneToOne: false
            referencedRelation: "feeds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_tag_association_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      feeds: {
        Row: {
          created_at: string | null
          description: string | null
          etag_header: string | null
          fetch_error_count: number | null
          folder_id: string
          id: string
          image_url: string | null
          is_favorite: boolean
          language: string | null
          last_article_published_at: string | null
          last_error_message: string | null
          last_fetched_at: string | null
          last_modified_header: string | null
          link: string | null
          skip_days: string[] | null
          skip_hours: number[] | null
          title: string | null
          ttl: number | null
          updated_at: string | null
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          etag_header?: string | null
          fetch_error_count?: number | null
          folder_id: string
          id: string
          image_url?: string | null
          is_favorite: boolean
          language?: string | null
          last_article_published_at?: string | null
          last_error_message?: string | null
          last_fetched_at?: string | null
          last_modified_header?: string | null
          link?: string | null
          skip_days?: string[] | null
          skip_hours?: number[] | null
          title?: string | null
          ttl?: number | null
          updated_at?: string | null
          url: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          etag_header?: string | null
          fetch_error_count?: number | null
          folder_id?: string
          id?: string
          image_url?: string | null
          is_favorite?: boolean
          language?: string | null
          last_article_published_at?: string | null
          last_error_message?: string | null
          last_fetched_at?: string | null
          last_modified_header?: string | null
          link?: string | null
          skip_days?: string[] | null
          skip_hours?: number[] | null
          title?: string | null
          ttl?: number | null
          updated_at?: string | null
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feeds_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feeds_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          id: string
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
          id: string
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
      tags: {
        Row: {
          created_at: string | null
          id: string
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id: string
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
            foreignKeyName: "tags_user_id_fkey"
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
          id: string
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
      [_ in never]: never
    }
    Enums: {
      bookformat: "EPUB" | "PDF"
      highlightcolor: "YELLOW" | "GREEN" | "BLUE"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      bookformat: ["EPUB", "PDF"],
      highlightcolor: ["YELLOW", "GREEN", "BLUE"],
    },
  },
} as const

