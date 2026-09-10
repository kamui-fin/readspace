"""Resource limits configuration for different user roles."""

# Codex Digest allowance - metered per user, not drawn from the shared ai_usage counter.
# The "day" is the reader's LOCAL calendar day (client-supplied), so quota resets at the
# user's own midnight.
#   Basic: 1 generation per local day AND at most `per_month` COMPLETED digests per calendar
#          month (only COMPLETED rows burn the monthly cap; a SKIPPED/FAILED retry does not).
#   Pro:   `per_day` generations ("editions") per local day, no monthly cap.
#   Admin: unlimited - enforce_codex_quota short-circuits on ADMIN.
CODEX_LIMITS = {
    "basic": {"per_day": 1, "per_month": 3},
    "pro": {"per_day": 2},
    "admin": {},
}

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
