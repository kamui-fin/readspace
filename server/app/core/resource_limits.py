"""Resource limits configuration for different user roles."""

RESOURCE_LIMITS = {
    "basic": {
        "max_subscriptions": 1000,
        "max_books": 10,
    },
    "pro": {
        "max_subscriptions": 1000,  # Same as basic for now
        "max_books": 10,
    },
    "admin": {
        # All -1 means unlimited
        "max_subscriptions": -1,
        "max_books": -1,
    }
}
