import asyncio
import json
import os
import sys
import traceback
from pathlib import Path
from typing import Optional

import asyncpg
from dotenv import load_dotenv
from supabase import create_client, Client

# Add parent directory to path to allow importing app modules if needed
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Load environment variables
load_dotenv(dotenv_path=Path(__file__).parent.parent / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
DATABASE_URL = os.getenv("DATABASE_URL_API")

if not SUPABASE_URL or not SUPABASE_KEY or not DATABASE_URL:
    print("Error: Missing environment variables.")
    sys.exit(1)

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
BUCKET_NAME = "favicons"

# Paths
BASE_DIR = Path(__file__).parent.parent.parent
FEEDS_JSONL = BASE_DIR / "feeds.jsonl"
FAVICONS_DIR = BASE_DIR / "favicons"


async def create_bucket_if_not_exists():
    """Create the favicons bucket if it doesn't exist."""
    try:
        buckets = supabase.storage.list_buckets()
        existing = [b.name for b in buckets]
        if BUCKET_NAME not in existing:
            print(f"Creating bucket '{BUCKET_NAME}'...")
            supabase.storage.create_bucket(BUCKET_NAME, options={"public": True})
        else:
            print(f"Bucket '{BUCKET_NAME}' already exists.")
    except Exception as e:
        print(f"Error checking/creating bucket: {e!r}")
        traceback.print_exc()


async def upload_favicon(
    image_path: str, content_type: str = "image/jpeg"
) -> Optional[str]:
    """
    Uploads a local favicon to Supabase storage.
    Returns the public path/key in the bucket.
    """
    if not image_path:
        return None

    # The JSONL usually has something like "favicons/filename"
    # We need the actual filename to find it in the favicons dir
    filename = os.path.basename(image_path)
    local_file_path = FAVICONS_DIR / filename

    if not local_file_path.exists():
        # print(f"Warning: Favicon file not found: {local_file_path}")
        return None

    try:
        # Check if file already exists in bucket (optional optimization)
        # For now, we'll just overwrite or upload.
        # Supabase storage 'upload' throws error if exists unless upsert=True ?
        # 'upload' method signature: upload(path, file, file_options)

        with open(local_file_path, "rb") as f:
            file_bytes = f.read()

        # We use the filename as the key in the bucket
        storage_path = filename

        # Use upsert to avoid errors if it exists
        supabase.storage.from_(BUCKET_NAME).upload(
            path=storage_path,
            file=file_bytes,
            file_options={
                "content-type": content_type,
                "upsert": "true",
            },  # Assuming jpeg/png content type detection might be better but user data says image/jpeg often
        )
        return storage_path

    except Exception as e:
        print(f"Error uploading {filename}: {e!r}")
        traceback.print_exc()
        return None


async def import_data():
    print("Ensuring Supabase bucket exists...")
    await create_bucket_if_not_exists()

    print(f"Connecting to database...")
    conn = await asyncpg.connect(DATABASE_URL)

    print("Clearing feeds table...")
    await conn.execute("TRUNCATE TABLE feeds CASCADE")

    print(f"Reading {FEEDS_JSONL}...")

    count = 0
    errors = 0

    try:
        with open(FEEDS_JSONL, "r") as f:
            for line in f:

                try:
                    record = json.loads(line)

                    # 1. Use existing image_url directly (don't try to upload)
                    icon_storage_path = record.get("image_url")

                    # 2. Extract Fields
                    url = record.get("feed_url")
                    title = record.get("title")
                    description = record.get(
                        "summary"
                    )  # Mapping summary -> description
                    link = record.get("website_url")  # Mapping website_url -> link
                    language = record.get("language")

                    # New columns
                    top_level_category = record.get("category", "miscellaneous")
                    content_type = record.get("content_type")
                    author = record.get("author")
                    tags = record.get("tags", [])
                    tags_native = record.get("tags_native", [])
                    popularity_score = record.get("popularity_score", 0)

                    # 3. Insert into DB
                    # We use ON CONFLICT (url) DO UPDATE to handle re-runs
                    query = """
                        INSERT INTO feeds (
                            url, title, description, link, language, image_url,
                            top_level_category, content_type, author, tags, tags_native,
                            popularity_score, created_at
                        ) VALUES (
                            $1, $2, $3, $4, $5, $6,
                            $7::feedcategory, $8::contenttype, $9, $10, $11,
                            $12, NOW()
                        )
                        ON CONFLICT (url) DO UPDATE SET
                            title = EXCLUDED.title,
                            description = EXCLUDED.description,
                            link = EXCLUDED.link,
                            language = EXCLUDED.language,
                            image_url = COALESCE(EXCLUDED.image_url, feeds.image_url),
                            top_level_category = EXCLUDED.top_level_category,
                            content_type = EXCLUDED.content_type,
                            author = EXCLUDED.author,
                            tags = EXCLUDED.tags,
                            tags_native = EXCLUDED.tags_native,
                            popularity_score = EXCLUDED.popularity_score,
                            last_updated_at = NOW()
                    """

                    await conn.execute(
                        query,
                        url,
                        title,
                        description,
                        link,
                        language,
                        icon_storage_path,
                        top_level_category,
                        content_type,
                        author,
                        tags,
                        tags_native,
                        popularity_score,
                    )

                    count += 1
                    if count % 100 == 0:
                        print(f"Processed {count} feeds...")

                except Exception as e:
                    print(f"Error processing line: {e}")
                    errors += 1

    finally:
        await conn.close()

    print(f"Done. Processed {count} feeds. Errors: {errors}")


if __name__ == "__main__":
    asyncio.run(import_data())
