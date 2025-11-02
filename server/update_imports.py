"""Script to update all imports after module refactoring."""

import re
from pathlib import Path

# Define import mappings
IMPORT_MAPPINGS = [
    # Schema imports
    (r"from app\.schemas\.rss_schemas import", "from app.schemas import"),
    # Model imports - consolidate to app.models
    (r"from app\.models\.rss_models import ([^(]+)", r"from app.models import \1"),
    # Worker imports - update to new modules
    (
        r"from app\.workers\.tasks import import_single_feed_task",
        "from app.workers.opml_tasks import import_single_feed_task",
    ),
    (r"from app\.workers\.tasks import import_opml_task", "from app.workers.opml_tasks import import_opml_task"),
    (
        r"from app\.workers\.tasks import refresh_single_feed_task",
        "from app.workers.feed_tasks import refresh_single_feed_task",
    ),
    (
        r"from app\.workers\.tasks import schedule_all_feed_refreshes_task",
        "from app.workers.feed_tasks import schedule_all_feed_refreshes_task",
    ),
    (r"from app\.workers\.tasks import enrich_feed_task", "from app.workers.feed_tasks import enrich_feed_task"),
    # Router imports - remove rss_ prefix
    (r"from app\.routers import rss_articles", "from app.routers import articles"),
    (r"from app\.routers import rss_discover", "from app.routers import discover"),
    (r"from app\.routers import rss_feeds", "from app.routers import feeds"),
    (r"from app\.routers import rss_folders", "from app.routers import folders"),
    (r"from app\.routers import rss_opml", "from app.routers import opml"),
    (r"from app\.routers import rss_similar", "from app.routers import similar"),
]


def update_file(file_path: Path) -> bool:
    """Update imports in a single file.

    Returns:
        True if file was modified, False otherwise
    """
    try:
        content = file_path.read_text()
        original_content = content

        for pattern, replacement in IMPORT_MAPPINGS:
            content = re.sub(pattern, replacement, content)

        if content != original_content:
            file_path.write_text(content)
            print(f"✓ Updated: {file_path}")
            return True
        return False
    except Exception as e:
        print(f"✗ Error updating {file_path}: {e}")
        return False


def main():
    """Update all Python files in the project."""
    server_dir = Path(__file__).parent
    python_files = list(server_dir.rglob("*.py"))

    # Exclude the update script itself and virtual environments
    python_files = [
        f
        for f in python_files
        if "update_imports.py" not in str(f)
        and ".venv" not in str(f)
        and "venv" not in str(f)
        and "__pycache__" not in str(f)
    ]

    print(f"Scanning {len(python_files)} Python files...")
    modified_count = 0

    for file_path in python_files:
        if update_file(file_path):
            modified_count += 1

    print(f"\n✓ Complete! Modified {modified_count} files.")


if __name__ == "__main__":
    main()
