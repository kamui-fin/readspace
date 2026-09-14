"""Unit tests for choosing which Meilisearch key the public /config endpoint may expose."""

from datetime import datetime, timezone

import pytest
from meilisearch_python_sdk.models.client import Key

from app.core.constants import MEILISEARCH_DEFAULT_SEARCH_KEY_NAME
from app.routers.info import select_public_search_key

pytestmark = pytest.mark.unit


def make_key(name: str, actions: list[str], key: str) -> Key:
    """Build a Meilisearch key model with only the fields the selector cares about."""
    return Key(
        uid=f"uid-{key}",
        name=name,
        description=None,
        actions=actions,
        indexes=["*"],
        expires_at=None,
        key=key,
        created_at=datetime.now(timezone.utc),
        updated_at=None,
    )


def test_returns_default_search_key() -> None:
    """The default search-only key is returned when present."""
    keys = [
        make_key("Default Admin API Key", ["*"], "admin-secret"),
        make_key(MEILISEARCH_DEFAULT_SEARCH_KEY_NAME, ["search"], "public-search"),
    ]

    assert select_public_search_key(keys) == "public-search"


def test_never_returns_admin_key_when_search_key_missing() -> None:
    """With no search-only key, nothing is returned - never the first key in the list."""
    keys = [
        make_key("Default Admin API Key", ["*"], "admin-secret"),
        make_key("Default Chat API Key", ["chatCompletions", "search"], "chat-secret"),
    ]

    assert select_public_search_key(keys) == ""


def test_rejects_wildcard_key_with_search_in_name() -> None:
    """A key named like a search key but holding every permission is not exposed."""
    keys = [make_key("search-but-actually-admin", ["*"], "admin-secret")]

    assert select_public_search_key(keys) == ""


def test_rejects_key_with_search_plus_other_actions() -> None:
    """A key that can also read documents could dump the index, so it is not exposed."""
    keys = [make_key("search-and-documents", ["search", "documents.get"], "wide-secret")]

    assert select_public_search_key(keys) == ""


def test_falls_back_to_other_search_only_key() -> None:
    """A renamed search-only key is used when the default one was deleted."""
    keys = [
        make_key("Default Admin API Key", ["*"], "admin-secret"),
        make_key("public-search", ["search"], "renamed-search"),
    ]

    assert select_public_search_key(keys) == "renamed-search"


def test_prefers_default_name_over_other_search_only_keys() -> None:
    """When several search-only keys exist, the default one wins."""
    keys = [
        make_key("public-search", ["search"], "renamed-search"),
        make_key(MEILISEARCH_DEFAULT_SEARCH_KEY_NAME, ["search"], "default-search"),
    ]

    assert select_public_search_key(keys) == "default-search"


def test_empty_key_list_returns_empty_string() -> None:
    """No keys at all yields an empty string."""
    assert select_public_search_key([]) == ""
