"""Resource limits configuration for different user roles."""

RESOURCE_LIMITS = {
    "basic": {
        "max_subscriptions": 1000,
    },
    "pro": {
        "max_subscriptions": 1000,  # Same as basic for now
    },
    "admin": {
        # All -1 means unlimited
        "max_subscriptions": -1,
    },
}
