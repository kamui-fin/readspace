"""
Factory classes for user-related models
"""

import uuid
from datetime import datetime, timezone

import factory
from factory.alchemy import SQLAlchemyModelFactory

from app.models.user_models import AuthUser, Profile


class AuthUserFactory(SQLAlchemyModelFactory):
    """Factory for AuthUser model"""

    class Meta:
        model = AuthUser
        sqlalchemy_session_persistence = "commit"

    id = factory.LazyFunction(uuid.uuid4)


class ProfileFactory(SQLAlchemyModelFactory):
    """Factory for Profile model"""

    class Meta:
        model = Profile
        sqlalchemy_session_persistence = "commit"

    id = factory.LazyFunction(uuid.uuid4)
    email = factory.Sequence(lambda n: f"user{n}@example.com")
    created_at = factory.LazyFunction(lambda: datetime.now(timezone.utc))
    updated_at = factory.LazyFunction(lambda: datetime.now(timezone.utc))

    @factory.post_generation
    def create_auth_user(obj, create, extracted, **kwargs):
        """Create corresponding auth.users entry"""
        if not create:
            return

        from sqlalchemy import text

        # Use a raw SQL insert to create the auth user entry
        # This should be called after the profile is created
        try:
            # Get the session from the factory
            if hasattr(obj, "_sa_session") and obj._sa_session:
                session = obj._sa_session
                session.execute(
                    text("""
                        INSERT INTO auth.users (
                            id, aud, role, email, encrypted_password, 
                            email_confirmed_at, invited_at, confirmation_token, 
                            confirmation_sent_at, recovery_token, recovery_sent_at, 
                            email_change_token_new, email_change, email_change_sent_at, 
                            last_sign_in_at, raw_app_meta_data, raw_user_meta_data, 
                            is_super_admin, created_at, updated_at, phone, 
                            phone_confirmed_at, phone_change, phone_change_token, 
                            phone_change_sent_at, email_change_token_current, 
                            email_change_confirm_status, banned_until, 
                            reauthentication_token, reauthentication_sent_at, 
                            is_sso_user, deleted_at, is_anonymous
                        ) VALUES (
                            :user_id, 'authenticated', 'authenticated', :email, '', 
                            NOW(), NULL, '', NOW(), '', NOW(), '', '', NOW(), NOW(), 
                            '{}', '{}', FALSE, NOW(), NOW(), NULL, NULL, '', '', 
                            NOW(), '', 0, NULL, '', NOW(), FALSE, NULL, FALSE
                        ) ON CONFLICT (id) DO NOTHING
                    """),
                    {"user_id": str(obj.id), "email": obj.email},
                )
        except Exception:
            # Ignore auth user creation failures in tests
            pass
