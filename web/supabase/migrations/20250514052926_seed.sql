-- 1) Global catalog of books
CREATE TABLE public.book_metadata (
  id               UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  title            TEXT               NOT NULL,
  author           TEXT,
  description      TEXT,
  cover_url        TEXT,
  file_url         TEXT,
  format           public.book_format NOT NULL,
  num_pages        INTEGER,
  file_size_bytes  BIGINT,
    -- <-- EPUB/PDF structure
  epub_chapter_char_counts   INTEGER[],
  epub_page_char_counts      INTEGER[],
  pdf_toc                    JSONB,
  created_at       TIMESTAMPTZ        NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ        NOT NULL DEFAULT now()
);

-- 2) Which users have which books, plus per‑user data
CREATE TABLE public.user_book_library (
  id                  UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID               NOT NULL
    REFERENCES auth.users(id) ON DELETE CASCADE,
  book_metadata_id    UUID               NOT NULL
    REFERENCES public.book_metadata(id) ON DELETE CASCADE,
  date_added          TIMESTAMPTZ        NOT NULL DEFAULT now(),
    -- <-- user‑specific progress
  epub_progress            JSONB,      -- could store things like { "last_page": 5, "percent": 0.2, … }
  pdf_current_page         INTEGER,    -- if you tracked “I’m on PDF page 42”
  UNIQUE(user_id, book_metadata_id)
);

-- 3) Highlights point at a user's library entry
CREATE TABLE public.highlights (
  id                  UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_book_lib_id         UUID                    NOT NULL
    REFERENCES public.user_book_library(id) ON DELETE CASCADE,
  color               public.highlight_color  NOT NULL,
  original_text       TEXT                    NOT NULL,
  note                TEXT,
  created_at          TIMESTAMPTZ             NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ             NOT NULL DEFAULT now()
);

-- 4) Location details
CREATE TABLE public.highlight_locations (
  id             UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  highlight_id   UUID     NOT NULL REFERENCES public.highlights(id) ON DELETE CASCADE,
  chapter_idx    INTEGER,
  chapter_href   TEXT,
  chapter_title  TEXT,
  page       INTEGER,
  html_range          JSONB,
  pdf_rect_position  JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);