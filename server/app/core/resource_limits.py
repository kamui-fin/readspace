"""Resource limits configuration for different user roles."""

RESOURCE_LIMITS = {
    "basic": {
        "max_subscriptions": 10,
        "max_daily_ai_calls": 5,
        "max_daily_scrapes": 5,
        "semantic_search": False,
        "read_later_retention_days": 30,
    },
    "pro": {
        "max_subscriptions": 1000,
        "max_daily_ai_calls": 100,
        "max_daily_scrapes": -1,  # Unlimited
        "semantic_search": True,
        "read_later_retention_days": -1,  # Unlimited
    },
    "admin": {
        # All -1 or True means unlimited / bypassed
        "max_subscriptions": -1,
        "max_daily_ai_calls": -1,
        "max_daily_scrapes": -1,
        "semantic_search": True,
        "read_later_retention_days": -1,
    },
}
