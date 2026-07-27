from datetime import datetime, timezone


def get_sync_cutoff() -> datetime:
    """
    Calculate the global 2-hour sync cutoff time for Basic users.
    Rounds down the current time to the nearest even UTC hour.
    """
    now = datetime.now(timezone.utc)
    even_hour = now.hour - (now.hour % 2)
    return now.replace(hour=even_hour, minute=0, second=0, microsecond=0)
