"""Intake and newsletter routing."""

import email.utils
import hashlib
import secrets
from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

import nh3
import structlog
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.custom_exceptions import FeedSubscriptionError, NotFoundError
from app.crud import profile as crud_profile
from app.crud.article.ingester import create_articles_batch
from app.crud.feed import core as feed_crud
from app.crud.feed.subscription import (
    create_subscription,
    get_subscription_by_feed_id,
)
from app.crud.folder import upsert_batch
from app.db.session import get_db
from app.models.enums import ContentType, UserRole
from app.routers.feeds.feeds_subscription import resolve_target_folder
from app.services.user.auth import get_current_user
from app.typing.entries import ArticleCreate
from app.typing.feeds import FeedBase
from app.typing.subscriptions import SubscriptionCreate, SubscriptionResponse
from app.typing.user import TokenData
from app.utils.text import clean_html_text

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/intake", tags=["Intake"])

ALLOWED_TAGS = {
    "a",
    "b",
    "blockquote",
    "br",
    "code",
    "div",
    "em",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "hr",
    "i",
    "img",
    "li",
    "ol",
    "p",
    "pre",
    "span",
    "strong",
    "style",
    "sub",
    "sup",
    "table",
    "tbody",
    "td",
    "tfoot",
    "th",
    "thead",
    "tr",
    "u",
    "ul",
}

ALLOWED_ATTRIBUTES = {
    "a": {"href", "title", "target"},
    "img": {"src", "alt", "title", "width", "height", "style"},
    # The "*" key allows these layout/style attributes on ALL tags
    "*": {"style", "class", "id", "colspan", "rowspan", "align", "valign"},
}


def clean_newsletter_html(raw_html: str) -> str:
    return nh3.clean(
        raw_html,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRIBUTES,
        clean_content_tags={"script"},  # Don't strip contents of style tags
        link_rel="noopener noreferrer",  # Automatically secures links!
    )


# ==========================================
# Schema Definitions
# ==========================================


class WebhookPayload(BaseModel):
    token: str
    from_address: str = Field(..., alias="from")
    from_name: str | None = None
    subject: str
    html: str
    list_url: str | None = None  # Extracted from List-Unsubscribe/List-Archive headers


class ManualNewsletterSubscribe(BaseModel):
    name: str
    sender_email: str
    folder_id: UUID | str = "default"


class TokenResponse(BaseModel):
    token: str
    email: str


# ==========================================
# Routes
# ==========================================


@router.post(
    "/webhook",
    status_code=status.HTTP_201_CREATED,
    summary="Inbound email webhook from Cloudflare Worker",
    description="Intakes parsed emails from Cloudflare Worker, maps to a user via token, and saves the content as a virtual feed article.",
)
async def webhook_intake(
    payload: WebhookPayload,
    request: Request,
    x_readspace_secret: Annotated[str | None, Header(alias="X-Readspace-Secret")] = None,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> dict:
    # 1. Security Check
    settings = get_settings()
    expected = settings.INBOUND_WEBHOOK_SECRET.strip().strip('"').strip("'") if settings.INBOUND_WEBHOOK_SECRET else ""
    received = x_readspace_secret.strip().strip('"').strip("'") if x_readspace_secret else ""

    if not received or received != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid signature or secret",
        )

    # 2. Get profile by newsletter token
    profile = await crud_profile.get_profile_by_newsletter_token(db, token=payload.token)
    if not profile:
        raise NotFoundError("Profile not found for token")

    # Guard: only allow premium users (PRO or ADMIN)
    if profile.role not in (UserRole.PRO, UserRole.ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Premium subscription required for newsletter ingestion",
        )

    # 3. Parse Sender email
    parsed_name, sender_email = email.utils.parseaddr(payload.from_address)
    sender_email = sender_email.strip().lower()
    if not sender_email:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid sender email",
        )

    # Use the real display name (from_name) if available from PostalMime, otherwise parseaddr name, otherwise email
    display_sender_name = payload.from_name.strip() if payload.from_name else parsed_name.strip()
    display_sender_name = display_sender_name or sender_email

    # 4. Find or Create Virtual Feed
    virtual_url = f"newsletter://{profile.id}/{sender_email}"
    feed = await feed_crud.get_feed_by_url(db, url=virtual_url)

    if not feed:
        feed = await feed_crud.create_feed(
            db,
            feed_data=FeedBase(
                url=virtual_url,
                title=display_sender_name,
                description=f"Newsletter subscription from {display_sender_name}",
                content_type=ContentType.NEWSLETTER,
                language="en",
                tags_native=[],
                link=payload.list_url or None,
            ),
        )
        # Queue background task to fetch favicon
        try:
            from app.workers.feed_tasks import fetch_favicon_task

            await fetch_favicon_task.kiq(feed_id=str(feed.id))
        except Exception as e:
            logger.warning(
                "Failed to queue background favicon task for newsletter",
                feed_id=str(feed.id),
                error=str(e),
            )

    # 5. Ensure user is subscribed
    sub = await get_subscription_by_feed_id(db, feed_id=feed.id, user_id=profile.id)
    if not sub:
        folder_map = await upsert_batch(db, folder_names=["Newsletters"], user_id=profile.id)
        folder_id = folder_map["Newsletters"]
        await create_subscription(
            db,
            user_id=profile.id,
            subscription_in=SubscriptionCreate(url=virtual_url, folder_id=folder_id),
            feed_db=feed,
        )

    # 6. Insert Article Content
    clean_html = clean_newsletter_html(payload.html) if payload.html else ""
    content_hash = hashlib.sha256((clean_html + payload.subject).encode("utf-8")).hexdigest()
    guid = f"newsletter://{profile.id}/{sender_email}/{content_hash}"

    plain_text = clean_html_text(payload.html) if payload.html else ""
    excerpt = (plain_text[:200] + "...") if len(plain_text) > 200 else plain_text

    article_create = ArticleCreate(
        feed_id=feed.id,
        title=payload.subject,
        link=guid,
        description=excerpt or None,
        content=clean_html,
        author=display_sender_name,
        published_at=datetime.now(timezone.utc),
        guid=guid,
    )

    await create_articles_batch(db, articles_data=[article_create])

    logger.info("Successfully ingested newsletter email", user_id=str(profile.id), feed_id=str(feed.id))
    return {"status": "success"}


@router.get(
    "/token",
    response_model=TokenResponse,
    summary="Get or generate newsletter token",
    description="Gets the user's personal newsletter token or generates a new one if it doesn't exist.",
)
async def get_or_generate_token(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
) -> TokenResponse:
    user_uuid = UUID(current_user.sub)
    profile = await crud_profile.get_profile_by_id(db, user_id=user_uuid)
    if not profile:
        raise NotFoundError("Profile not found")

    if profile.role not in (UserRole.PRO, UserRole.ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Premium subscription required for newsletter ingestion",
        )

    # Generate token if missing
    if not profile.newsletter_token:
        # Generate an 8-character secure token
        token = secrets.token_hex(4)
        # Ensure uniqueness
        while await crud_profile.get_profile_by_newsletter_token(db, token=token):
            token = secrets.token_hex(4)
        profile.newsletter_token = token
        db.add(profile)
        await db.commit()
        await db.refresh(profile)

    # Construct clean email alias
    # E.g., user.token@newsletters.readspace.ai
    username = profile.email.split("@")[0]
    # Replace non-alphanumeric chars in username to keep email structure safe
    clean_username = "".join(c for c in username if c.isalnum() or c in (".", "_", "-")).lower()
    inbound_email = f"{clean_username}.{profile.newsletter_token}@newsletters.readspace.ai"

    return TokenResponse(token=profile.newsletter_token, email=inbound_email)


@router.post(
    "/subscribe",
    response_model=SubscriptionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Manually subscribe to a newsletter feed",
    description="Pre-creates a virtual newsletter feed subscription so that emails land in the chosen folder.",
)
async def subscribe_newsletter(
    subscribe_in: ManualNewsletterSubscribe,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
) -> SubscriptionResponse:
    user_uuid = UUID(current_user.sub)
    profile = await crud_profile.get_profile_by_id(db, user_id=user_uuid)
    if not profile:
        raise NotFoundError("Profile not found")

    if profile.role not in (UserRole.PRO, UserRole.ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Premium subscription required for newsletter ingestion",
        )

    sender_email = subscribe_in.sender_email.strip().lower()
    if not sender_email or "@" not in sender_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid sender email address",
        )

    virtual_url = f"newsletter://{user_uuid}/{sender_email}"

    # 1. Find or create virtual feed
    feed = await feed_crud.get_feed_by_url(db, url=virtual_url)
    if not feed:
        feed = await feed_crud.create_feed(
            db,
            feed_data=FeedBase(
                url=virtual_url,
                title=subscribe_in.name,
                description=f"Newsletter subscription from {subscribe_in.name}",
                content_type=ContentType.NEWSLETTER,
                language="en",
                tags_native=[],
            ),
        )
        # Queue background task to fetch favicon
        try:
            from app.workers.feed_tasks import fetch_favicon_task

            await fetch_favicon_task.kiq(feed_id=str(feed.id))
        except Exception as e:
            logger.warning(
                "Failed to queue background favicon task for newsletter",
                feed_id=str(feed.id),
                error=str(e),
            )

    # 2. Check limits & resolve folder
    folder_id_input = subscribe_in.folder_id
    if folder_id_input == "default" or not folder_id_input or str(folder_id_input).strip() == "":
        folder_map = await upsert_batch(db, folder_names=["Newsletters"], user_id=user_uuid)
        folder_id = folder_map["Newsletters"]
    else:
        folder_id = await resolve_target_folder(db, user_uuid, folder_id_input)

    # 3. Create subscription
    try:
        sub = await create_subscription(
            db,
            user_id=user_uuid,
            subscription_in=SubscriptionCreate(url=virtual_url, folder_id=folder_id, custom_title=subscribe_in.name),
            feed_db=feed,
        )
    except FeedSubscriptionError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    return sub
