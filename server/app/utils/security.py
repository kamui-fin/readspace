import ipaddress
from urllib.parse import urlparse

from app.core.config import get_settings
from app.core.custom_exceptions import ValidationError

ALLOWED_SCHEMES = {"http", "https", "rsshub"}
BLOCKED_HOSTNAMES = {"localhost", "0.0.0.0"}  # noqa: S104


def is_ip_address(host: str) -> bool:
    try:
        ipaddress.ip_address(host)
        return True
    except ValueError:
        return False


def validate_url_security(url: str, allow_rsshub: bool = True) -> None:
    """
    SSRF Protection: Validates that a URL does not point to a local/private network.
    """
    try:
        parsed = urlparse(url)
    except Exception as e:
        raise ValidationError(f"Invalid URL structure: {e}") from e

    # 1. Check Scheme
    if not parsed.scheme or parsed.scheme.lower() not in ALLOWED_SCHEMES:
        raise ValidationError(f"Invalid scheme: {parsed.scheme}")

    if parsed.scheme == "rsshub":
        if not allow_rsshub:
            raise ValidationError("RSShub scheme not allowed in this context")
        return

    hostname = parsed.hostname
    if not hostname:
        raise ValidationError("URL has no hostname")

    settings = get_settings()

    # 2. Allow list bypass (e.g. your own RSSHub instance)
    if settings.RSSHUB_URL and hostname in settings.RSSHUB_URL:
        return

    # 3. Block explicit localhost names
    if hostname.lower() in BLOCKED_HOSTNAMES:
        raise ValidationError(f"Blocked hostname: {hostname}")

    # 4. Check IP Address (Private/Loopback/Link-local)
    # If the hostname is an IP (e.g. 192.168.1.1), check it directly
    # If it is a domain (google.com), we trust standard DNS resolution via httpx later,
    # OR you can optionally resolve DNS here to prevent DNS Rebinding attacks (advanced).
    if is_ip_address(hostname):
        try:
            ip = ipaddress.ip_address(hostname)
            if ip.is_private or ip.is_loopback or ip.is_link_local:
                raise ValidationError(f"Private IP address not allowed: {hostname}")
        except ValueError:
            pass
