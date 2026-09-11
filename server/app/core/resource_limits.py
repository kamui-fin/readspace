"""Resource limits configuration for different user roles."""

# Codex Digest allowance - metered per user, not drawn from the shared ai_usage counter.
#
# The generation cap is a ROLLING WINDOW keyed on the server clock (a digest's requested_at),
# NOT on any client-supplied date - so it can't be gamed by changing the device timezone or
# clock, and it resets continuously (the oldest generation ages out CODEX_QUOTA_WINDOW_HOURS
# after it was requested). CODEX_QUOTA_WINDOW_HOURS is a little under 24 so a "late tonight +
# tomorrow morning" pattern still works while >2/day stays impossible.
#
#   Basic: `per_window` generation in any CODEX_QUOTA_WINDOW_HOURS, AND at most `per_month`
#          COMPLETED digests per calendar month (server clock). Only COMPLETED rows burn the
#          monthly cap; a SKIPPED/FAILED retry does not.
#   Pro:   `per_window` generations in any CODEX_QUOTA_WINDOW_HOURS, no monthly cap.
#   Admin: unlimited - enforce_codex_quota short-circuits on ADMIN.
CODEX_QUOTA_WINDOW_HOURS = 22

CODEX_LIMITS = {
    "basic": {"per_window": 1, "per_month": 3},
    "pro": {"per_window": 2},
    "admin": {},
}

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
