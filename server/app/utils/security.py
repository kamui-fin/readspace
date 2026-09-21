"""SSRF protection for every outbound request that targets a user/feed-controlled URL.

Defence in depth:
1. ``validate_url_security`` - pre-flight check (scheme, hostname, resolved IPs).
2. ``SSRFSafeResolver`` - filters IPs again at connect time (closes the DNS-rebinding gap).
3. ``build_ssrf_trace_config`` - re-validates every redirect hop before it is followed.
"""

import asyncio
import ipaddress
import socket
from typing import Any
from urllib.parse import urljoin, urlparse

import aiohttp
import structlog
from aiohttp.abc import AbstractResolver, ResolveResult
from aiohttp.resolver import ThreadedResolver

from app.core.config import get_settings
from app.core.constants import BLOCKED_HOSTNAMES, BLOCKED_IP_NETWORKS, SSRF_ALLOWED_SCHEMES
from app.core.custom_exceptions import ValidationError

logger = structlog.get_logger(__name__)

_DEFAULT_PORTS = {"http": 80, "https": 443}


def is_ip_address(host: str) -> bool:
    """Return True if ``host`` is a literal IPv4/IPv6 address."""
    try:
        ipaddress.ip_address(host)
        return True
    except ValueError:
        return False


def is_blocked_ip(ip: str) -> bool:
    """Return True if the IP is not a public, globally routable address."""
    try:
        addr = ipaddress.ip_address(ip.split("%", 1)[0])  # strip IPv6 zone id
    except ValueError:
        return True  # unparseable -> fail closed

    if isinstance(addr, ipaddress.IPv6Address) and addr.ipv4_mapped:
        addr = addr.ipv4_mapped

    if (
        addr.is_private
        or addr.is_loopback
        or addr.is_link_local
        or addr.is_multicast
        or addr.is_reserved
        or addr.is_unspecified
    ):
        return True
    return any(addr in network for network in BLOCKED_IP_NETWORKS if addr.version == network.version)


def _private_urls_allowed() -> bool:
    """Self-hosters can opt in to fetching feeds from their own network."""
    return get_settings().ALLOW_PRIVATE_FEED_URLS


def _is_rsshub_host(hostname: str, port: int | None) -> bool:
    """Exact host (and port) match against the configured RSSHub instance."""
    rsshub_url = get_settings().RSSHUB_URL
    if not rsshub_url:
        return False
    parsed = urlparse(rsshub_url)
    if not parsed.hostname or parsed.hostname.lower() != hostname.lower():
        return False
    rsshub_port = parsed.port or _DEFAULT_PORTS.get(parsed.scheme)
    return port is None or rsshub_port == port


def _check_hostname(hostname: str) -> None:
    normalized = hostname.lower().rstrip(".")
    if normalized in BLOCKED_HOSTNAMES or normalized.endswith((".localhost", ".internal", ".local")):
        raise ValidationError(f"Blocked hostname: {hostname}")


async def validate_url_security(url: str, allow_rsshub: bool = True) -> None:
    """
    SSRF protection: ensure a URL only targets public hosts.

    Resolves DNS and rejects the URL if *any* resolved address is private, loopback,
    link-local, multicast, reserved or CGNAT. Raises ``ValidationError`` on violation.
    """
    try:
        parsed = urlparse(url)
        port = parsed.port
    except ValueError as e:
        raise ValidationError(f"Invalid URL structure: {e}") from e

    scheme = (parsed.scheme or "").lower()
    if scheme not in SSRF_ALLOWED_SCHEMES:
        raise ValidationError(f"Invalid scheme: {parsed.scheme}")

    if scheme == "rsshub":
        if not allow_rsshub:
            raise ValidationError("RSShub scheme not allowed in this context")
        return

    hostname = parsed.hostname
    if not hostname:
        raise ValidationError("URL has no hostname")

    # Our own RSSHub instance legitimately lives on an internal address.
    if _is_rsshub_host(hostname, port or _DEFAULT_PORTS.get(scheme)):
        return

    if _private_urls_allowed():
        return

    _check_hostname(hostname)

    if is_ip_address(hostname):
        if is_blocked_ip(hostname):
            raise ValidationError(f"Private IP address not allowed: {hostname}")
        return

    try:
        infos = await asyncio.get_running_loop().getaddrinfo(
            hostname, port or _DEFAULT_PORTS[scheme], type=socket.SOCK_STREAM
        )
    except socket.gaierror as e:
        raise ValidationError(f"Could not resolve hostname: {hostname}") from e

    for info in infos:
        resolved_ip = str(info[4][0])
        if is_blocked_ip(resolved_ip):
            logger.warning("Blocked SSRF attempt", url=url, resolved_ip=resolved_ip)
            raise ValidationError(f"Hostname resolves to a private address: {hostname}")


class SSRFSafeResolver(AbstractResolver):
    """aiohttp resolver that drops non-public addresses at connect time."""

    def __init__(self) -> None:
        self._inner = ThreadedResolver()

    async def resolve(
        self, host: str, port: int = 0, family: socket.AddressFamily = socket.AF_INET
    ) -> list[ResolveResult]:
        results = await self._inner.resolve(host, port, family)
        if _private_urls_allowed() or _is_rsshub_host(host, port):
            return results
        safe = [r for r in results if not is_blocked_ip(r["host"])]
        if not safe:
            raise OSError(f"Blocked private address for host: {host}")
        return safe

    async def close(self) -> None:
        await self._inner.close()


async def _validate_redirect(_session: Any, _ctx: Any, params: aiohttp.TraceRequestRedirectParams) -> None:
    """Validate a redirect target before aiohttp follows it (never allows rsshub://)."""
    location = params.response.headers.get("Location")
    if location:
        await validate_url_security(urljoin(str(params.url), location), allow_rsshub=False)


def build_ssrf_trace_config() -> aiohttp.TraceConfig:
    """Trace config that validates each redirect target before aiohttp follows it."""
    trace_config = aiohttp.TraceConfig()
    trace_config.on_request_redirect.append(_validate_redirect)
    return trace_config
