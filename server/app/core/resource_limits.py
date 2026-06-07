"""Resource limits configuration for different user roles."""

RESOURCE_LIMITS = {
    "basic": {
        "max_subscriptions": 5,
        "max_daily_ai_calls": 3,
        "semantic_search": False,
        "read_later_retention_days": 30,
    },
    "pro": {
        "max_subscriptions": 1000,
        "max_daily_ai_calls": 100,
        "semantic_search": True,
        "read_later_retention_days": -1,  # Unlimited
    },
    "admin": {
        # All -1 or True means unlimited / bypassed
        "max_subscriptions": -1,
        "max_daily_ai_calls": -1,
        "semantic_search": True,
        "read_later_retention_days": -1,
    },
}
