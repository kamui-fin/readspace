"""Intake and newsletter routing."""

import email.utils
import hashlib
import secrets
from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

import structlog
from fastapi import APIRouter, Body, Depends, Header, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.custom_exceptions import NotFoundError, FeedSubscriptionError
from app.crud import profile as crud_profile
from app.crud.feed import core as feed_crud
from app.crud.feed.subscription import (
    create_subscription,
    get_subscription_by_feed_id,
)
from app.crud.article.ingester import create_articles_batch
from app.crud.folder import upsert_batch
from app.db.session import get_db
from app.models.enums import ContentType, UserRole
from app.models.user import Profile
from app.routers.feeds.feeds_subscription import resolve_target_folder
from app.services.user.auth import get_current_user
from app.typing.entries import ArticleCreate
from app.typing.feeds import FeedBase
from app.typing.subscriptions import SubscriptionCreate, SubscriptionResponse
from app.typing.user import TokenData

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/intake", tags=["Intake"])


# ==========================================
# Schema Definitions
# ==========================================


class WebhookPayload(BaseModel):
    token: str
    from_address: str = Field(..., alias="from")
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
    x_readspace_secret: Annotated[str | None, Header(alias="X-Readspace-Secret")] = None,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> dict:
    # 1. Security Check
    settings = get_settings()
    if not x_readspace_secret or x_readspace_secret != settings.INBOUND_WEBHOOK_SECRET:
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
    sender_name, sender_email = email.utils.parseaddr(payload.from_address)
    sender_email = sender_email.strip().lower()
    if not sender_email:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid sender email",
        )
    sender_name = sender_name.strip() or sender_email

    # 4. Find or Create Virtual Feed
    virtual_url = f"newsletter://{profile.id}/{sender_email}"
    feed = await feed_crud.get_feed_by_url(db, url=virtual_url)

    if not feed:
        feed = await feed_crud.create_feed(
            db,
            feed_data=FeedBase(
                url=virtual_url,
                title=sender_name,
                description=f"Newsletter subscription from {sender_name}",
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
    content_hash = hashlib.sha256((payload.html + payload.subject).encode("utf-8")).hexdigest()
    guid = f"newsletter://{profile.id}/{sender_email}/{content_hash}"

    article_create = ArticleCreate(
        feed_id=feed.id,
        title=payload.subject,
        link=guid,
        description=payload.html[:200] + "..." if payload.html else None,
        content=payload.html,
        author=sender_name,
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
    # E.g., user.token@newsletters.readspace.com
    username = profile.email.split("@")[0]
    # Replace non-alphanumeric chars in username to keep email structure safe
    clean_username = "".join(c for c in username if c.isalnum() or c in (".", "_", "-")).lower()
    inbound_email = f"{clean_username}.{profile.newsletter_token}@newsletters.readspace.com"

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
            subscription_in=SubscriptionCreate(
                url=virtual_url, folder_id=folder_id, custom_title=subscribe_in.name
            ),
            feed_db=feed,
        )
    except FeedSubscriptionError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    return sub
