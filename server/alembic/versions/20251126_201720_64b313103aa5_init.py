"""init

Revision ID: 64b313103aa5
Revises:
Create Date: 2025-11-26 20:17:20.429466+00:00

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "64b313103aa5"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""

    # 1. Extensions
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto;")

    # 2. Enums
    op.execute(
        """
        CREATE TYPE public.feedcategory AS ENUM (
            'TECHNOLOGY_PROGRAMMING', 'CULTURE_ARTS', 'LIFESTYLE_PERSONAL', 'MISCELLANEOUS', 
            'DESIGN_CREATIVITY', 'SCIENCE_RESEARCH', 'NEWS_POLITICS', 'GAMING_ENTERTAINMENT', 
            'BUSINESS_FINANCE', 'ARTIFICIAL_INTELLIGENCE', 'SECURITY_PRIVACY', 'EDUCATION_LEARNING'
        );
    """
    )

    op.execute("CREATE TYPE public.articlepriority AS ENUM ('LOW', 'MEDIUM', 'HIGH');")
    op.execute("CREATE TYPE public.userrole AS ENUM ('BASIC', 'PRO', 'ADMIN');")

    # 3. Tables
    # Profiles
    op.execute(
        """
        CREATE TABLE public.profiles (
            id uuid NOT NULL PRIMARY KEY,
            email text NOT NULL,
            role public.userrole NOT NULL DEFAULT 'BASIC'::public.userrole,
            created_at timestamp with time zone NOT NULL DEFAULT now(),
            updated_at timestamp with time zone NOT NULL DEFAULT now()
        ) TABLESPACE pg_default;
    """
    )

    # Folders
    op.execute(
        """
        CREATE TABLE public.folders (
            id uuid NOT NULL DEFAULT gen_random_uuid(),
            name text NOT NULL,
            user_id uuid NOT NULL,
            created_at timestamp with time zone NOT NULL DEFAULT now(),
            
            CONSTRAINT folders_pkey PRIMARY KEY (id),
            CONSTRAINT uq_folder_user_name UNIQUE (user_id, name),
            CONSTRAINT folders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
            CONSTRAINT ck_folder_name_not_empty CHECK (name <> '')
        ) TABLESPACE pg_default;
    """
    )

    # Feeds
    op.execute(
        """
        CREATE TABLE public.feeds (
            id uuid NOT NULL DEFAULT gen_random_uuid(),
            url text NOT NULL,
            title text NOT NULL,
            description text NOT NULL,
            link text,
            language text NOT NULL,
            image_url text,
            
            last_fetched_at timestamp with time zone NOT NULL DEFAULT now(),
            next_fetch_at timestamp with time zone NOT NULL DEFAULT now(),
            adaptive_fetch_interval_minutes integer,
            fetch_error_count integer NOT NULL DEFAULT 0,
            last_error_message text,
            
            etag_header text,
            last_modified_header text,
            content_hash varchar(64),
            
            tags text[],
            top_level_category public.feedcategory NOT NULL DEFAULT 'MISCELLANEOUS'::public.feedcategory,
            popularity_score double precision NOT NULL DEFAULT 0,
            subscriber_count integer NOT NULL DEFAULT 0,
            
            created_at timestamp with time zone NOT NULL DEFAULT now(),
            last_updated_at timestamp with time zone,
            
            CONSTRAINT feeds_pkey PRIMARY KEY (id),
            CONSTRAINT feeds_url_key UNIQUE (url),
            CONSTRAINT chk_url_not_empty CHECK (length(trim(url)) > 0)
        ) TABLESPACE pg_default;
    """
    )

    # Article Contents
    op.execute(
        """
        CREATE TABLE public.article_contents (
            id uuid NOT NULL DEFAULT gen_random_uuid(),
            content_hash char(64) NOT NULL,
            title text NOT NULL,
            link text,
            description text,
            content text,
            author text,
            image_url text,
            created_at timestamp with time zone NOT NULL DEFAULT now(),
            
            CONSTRAINT article_contents_pkey PRIMARY KEY (id),
            CONSTRAINT uq_article_contents_hash UNIQUE (content_hash)
        ) TABLESPACE pg_default;
    """
    )

    # Feed Articles
    op.execute(
        """
        CREATE TABLE public.feed_articles (
            id uuid NOT NULL DEFAULT gen_random_uuid(),
            feed_id uuid NOT NULL,
            content_id uuid NOT NULL,
            guid_hash char(64) NOT NULL,
            published_at timestamp with time zone NOT NULL,
            created_at timestamp with time zone NOT NULL DEFAULT now(),
            
            CONSTRAINT feed_articles_pkey PRIMARY KEY (id),
            CONSTRAINT uq_feed_articles_feed_guid_hash UNIQUE (feed_id, guid_hash),
            CONSTRAINT feed_articles_feed_id_fkey FOREIGN KEY (feed_id) REFERENCES public.feeds(id) ON DELETE CASCADE,
            CONSTRAINT feed_articles_content_id_fkey FOREIGN KEY (content_id) REFERENCES public.article_contents(id) ON DELETE CASCADE
        ) TABLESPACE pg_default;
    """
    )

    # Subscriptions
    op.execute(
        """
        CREATE TABLE public.feed_subscriptions (
            id uuid NOT NULL DEFAULT gen_random_uuid(),
            user_id uuid NOT NULL,
            feed_id uuid NOT NULL,
            folder_id uuid NOT NULL,
            is_favorite boolean NOT NULL DEFAULT false,
            custom_title text,
            last_read_cutoff timestamp with time zone,
            created_at timestamp with time zone NOT NULL DEFAULT now(),
            
            CONSTRAINT feed_subscriptions_pkey PRIMARY KEY (id),
            CONSTRAINT feed_subscriptions_feed_id_fkey FOREIGN KEY (feed_id) REFERENCES public.feeds(id) ON DELETE CASCADE,
            CONSTRAINT feed_subscriptions_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.folders(id) ON DELETE CASCADE,
            CONSTRAINT feed_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE
        ) TABLESPACE pg_default;
    """
    )

    # User Entries
    op.execute(
        """
        CREATE TABLE public.user_entries (
            id uuid NOT NULL DEFAULT gen_random_uuid(),
            user_id uuid NOT NULL,
            content_id uuid,
            feed_article_id uuid,
            
            is_read boolean NOT NULL DEFAULT false,
            is_saved boolean NOT NULL DEFAULT false,
            priority public.articlepriority NOT NULL DEFAULT 'LOW'::public.articlepriority,
            user_note text,
            read_at timestamp with time zone,
            
            created_at timestamp with time zone NOT NULL DEFAULT now(),
            updated_at timestamp with time zone NOT NULL DEFAULT now(),
            
            CONSTRAINT user_entries_pkey PRIMARY KEY (id),
            CONSTRAINT uq_user_entry_content UNIQUE (user_id, content_id),
            CONSTRAINT user_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
            CONSTRAINT user_entries_content_id_fkey FOREIGN KEY (content_id) REFERENCES public.article_contents(id) ON DELETE CASCADE,
            CONSTRAINT user_entries_feed_article_id_fkey FOREIGN KEY (feed_article_id) REFERENCES public.feed_articles(id) ON DELETE CASCADE
        ) TABLESPACE pg_default;
    """
    )

    # 4. Indexes
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_feeds_worker_fetch ON public.feeds (next_fetch_at ASC, subscriber_count DESC);"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_feed_articles_feed_published ON public.feed_articles (feed_id, published_at DESC);"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_feed_articles_content ON public.feed_articles (content_id);"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_feed_subscriptions_user_folder ON public.feed_subscriptions (user_id, folder_id);"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_feed_subscriptions_user_feed ON public.feed_subscriptions (user_id, feed_id);"
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_user_entries_read_later 
        ON public.user_entries (user_id, created_at DESC) 
        WHERE is_saved = true;
    """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_user_entries_read_history 
        ON public.user_entries (user_id, read_at DESC) 
        WHERE is_read = true;
    """
    )

    # 5. Functions
    op.execute(
        """
        CREATE OR REPLACE FUNCTION public.update_feed_subscriber_count()
        RETURNS trigger AS $$
        BEGIN
            IF TG_OP = 'INSERT' THEN
                UPDATE public.feeds SET subscriber_count = subscriber_count + 1 
                WHERE id = NEW.feed_id;
                RETURN NEW;
            ELSIF TG_OP = 'DELETE' THEN
                UPDATE public.feeds SET subscriber_count = subscriber_count - 1 
                WHERE id = OLD.feed_id;
                RETURN OLD;
            END IF;
            RETURN NULL;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
    """
    )

    op.execute(
        """
        CREATE OR REPLACE FUNCTION public.create_default_folder_for_user()
        RETURNS trigger AS $$
        BEGIN
            INSERT INTO public.folders (id, name, user_id, created_at)
            VALUES (gen_random_uuid(), 'My Feeds', NEW.id, NOW());
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
    """
    )

    op.execute(
        """
        CREATE OR REPLACE FUNCTION public.handle_new_user()
        RETURNS trigger AS $$
        BEGIN
            INSERT INTO public.profiles (id, email, created_at, updated_at)
            VALUES (new.id, new.email, new.created_at, new.updated_at);
            RETURN new;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
    """
    )

    # 6. Triggers
    op.execute(
        "DROP TRIGGER IF EXISTS feed_subscription_insert_trigger ON public.feed_subscriptions;"
    )
    op.execute(
        """
        CREATE TRIGGER feed_subscription_insert_trigger
        AFTER INSERT ON public.feed_subscriptions
        FOR EACH ROW EXECUTE FUNCTION public.update_feed_subscriber_count();
    """
    )

    op.execute(
        "DROP TRIGGER IF EXISTS feed_subscription_delete_trigger ON public.feed_subscriptions;"
    )
    op.execute(
        """
        CREATE TRIGGER feed_subscription_delete_trigger
        AFTER DELETE ON public.feed_subscriptions
        FOR EACH ROW EXECUTE FUNCTION public.update_feed_subscriber_count();
    """
    )

    op.execute(
        "DROP TRIGGER IF EXISTS trigger_create_default_folder ON public.profiles;"
    )
    op.execute(
        """
        CREATE TRIGGER trigger_create_default_folder
        AFTER INSERT ON public.profiles
        FOR EACH ROW EXECUTE FUNCTION public.create_default_folder_for_user();
    """
    )

    # Note: Attempting to attach to auth.users.
    # This might fail if the migration user does not have permissions on the auth schema.
    try:
        op.execute(
            """
            CREATE TRIGGER on_auth_user_created
            AFTER INSERT ON auth.users
            FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
        """
        )
    except Exception:
        print("Warning: Could not create trigger on auth.users. Check permissions.")


def downgrade() -> None:
    """Downgrade schema."""
    # Reverse order drop
    op.execute("DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;")
    op.execute(
        "DROP TRIGGER IF EXISTS trigger_create_default_folder ON public.profiles;"
    )
    op.execute(
        "DROP TRIGGER IF EXISTS feed_subscription_delete_trigger ON public.feed_subscriptions;"
    )
    op.execute(
        "DROP TRIGGER IF EXISTS feed_subscription_insert_trigger ON public.feed_subscriptions;"
    )

    op.execute("DROP FUNCTION IF EXISTS public.handle_new_user;")
    op.execute("DROP FUNCTION IF EXISTS public.create_default_folder_for_user;")
    op.execute("DROP FUNCTION IF EXISTS public.update_feed_subscriber_count;")

    op.execute("DROP TABLE IF EXISTS public.user_entries;")
    op.execute("DROP TABLE IF EXISTS public.feed_subscriptions;")
    op.execute("DROP TABLE IF EXISTS public.feed_articles;")
    op.execute("DROP TABLE IF EXISTS public.article_contents;")
    op.execute("DROP TABLE IF EXISTS public.feeds;")
    op.execute("DROP TABLE IF EXISTS public.folders;")
    op.execute("DROP TABLE IF EXISTS public.profiles;")

    op.execute("DROP TYPE IF EXISTS public.userrole;")
    op.execute("DROP TYPE IF EXISTS public.articlepriority;")
    op.execute("DROP TYPE IF EXISTS public.feedcategory;")
