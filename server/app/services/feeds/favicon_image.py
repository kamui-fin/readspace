"""Pure image helpers that normalize any favicon to a bounded-size PNG.

Nothing here touches the network or the database, so it is unit-testable in isolation.
"""

import io
import re
from enum import Enum

import resvg_py
import structlog
from PIL import Image, UnidentifiedImageError

from app.core.constants import FAVICON_MAX_INPUT_BYTES, FAVICON_MAX_PX

logger = structlog.get_logger(__name__)

# ``extract_favicon`` serializes SVGs through ElementTree, which emits ``<ns0:svg ...>``,
# so detection must tolerate an arbitrary namespace prefix.
_SVG_ROOT_RE = re.compile(rb"<(?:[A-Za-z_][\w.-]*:)?svg[\s>]", re.IGNORECASE)
_SVG_TEXT_RE = re.compile(rb"<(?:[A-Za-z_][\w.-]*:)?text[\s>]", re.IGNORECASE)
_SVG_GREY_RECT_RE = re.compile(rb"<(?:[A-Za-z_][\w.-]*:)?rect[^>]*fill\s*=\s*[\"']#c{3}[\"']", re.IGNORECASE)
_SVG_ROOT_TAG_RE = re.compile(r"<(?:[A-Za-z_][\w.-]*:)?svg\b[^>]*>", re.IGNORECASE)
_SVG_SIZE_ATTR_RE = re.compile(r"""\b(width|height)\s*=\s*["']?([\d.]+)""", re.IGNORECASE)
_SVG_VIEWBOX_RE = re.compile(r"\bviewBox\s*=", re.IGNORECASE)
_SVG_ROOT_SIZE_ATTR_STRIP_RE = re.compile(r"""\s(?:width|height)\s*=\s*(["']).*?\1""", re.IGNORECASE)
_SVG_SNIFF_BYTES = 2048
_PLACEHOLDER_MAX_BYTES = 1024


class ImageKind(str, Enum):
    """Real image format of a byte payload, determined from magic bytes."""

    PNG = "png"
    JPEG = "jpeg"
    GIF = "gif"
    WEBP = "webp"
    ICO = "ico"
    BMP = "bmp"
    TIFF = "tiff"
    AVIF = "avif"
    SVG = "svg"
    UNKNOWN = "unknown"


def sniff_image_kind(data: bytes) -> ImageKind:
    """
    Determine the real format of ``data`` from its bytes, ignoring any declared MIME type.

    Args:
        data: Raw file content

    Returns:
        The detected ImageKind, or ImageKind.UNKNOWN if nothing matches
    """
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return ImageKind.PNG
    if data.startswith(b"\xff\xd8\xff"):
        return ImageKind.JPEG
    if data[:6] in (b"GIF87a", b"GIF89a"):
        return ImageKind.GIF
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return ImageKind.WEBP
    if data.startswith(b"\x00\x00\x01\x00"):
        return ImageKind.ICO
    if data.startswith(b"BM"):
        return ImageKind.BMP
    if data[:4] in (b"II*\x00", b"MM\x00*"):
        return ImageKind.TIFF
    if data[4:8] == b"ftyp" and data[8:12] in (b"avif", b"avis"):
        return ImageKind.AVIF
    if _SVG_ROOT_RE.search(data[:_SVG_SNIFF_BYTES]):
        return ImageKind.SVG
    return ImageKind.UNKNOWN


def is_generated_placeholder(data: bytes) -> bool:
    """
    Detect ``extract_favicon``'s synthetic fallback: a grey ``#ccc`` box with one letter.

    These carry no information about the feed, so clients should render their own themed
    fallback instead of fetching them.

    Args:
        data: Raw file content

    Returns:
        True if the payload is a tiny SVG matching the generated-letter-box shape
    """
    if len(data) > _PLACEHOLDER_MAX_BYTES or sniff_image_kind(data) != ImageKind.SVG:
        return False
    return bool(_SVG_GREY_RECT_RE.search(data) and _SVG_TEXT_RE.search(data))


def _prepare_svg_size(svg: str) -> str:
    """
    Make ``viewBox`` the only source of size on the root element.

    resvg rejects roots whose ``width``/``height`` carry physical units (``5mm``, ``700pt``)
    with "invalid size", and cannot scale roots that lack a ``viewBox``. So synthesize a
    ``viewBox`` from ``width``/``height`` when missing, then drop those attributes and let the
    render width in ``_rasterize_svg`` decide the output size.
    """
    match = _SVG_ROOT_TAG_RE.search(svg)
    if not match:
        return svg
    tag = match.group(0)
    if not _SVG_VIEWBOX_RE.search(tag):
        sizes = {name.lower(): float(value) for name, value in _SVG_SIZE_ATTR_RE.findall(tag)}
        width, height = sizes.get("width"), sizes.get("height")
        if not width or not height:
            return svg
        closing = "/>" if tag.endswith("/>") else ">"
        tag_with_box = tag[: -len(closing)].rstrip() + f' viewBox="0 0 {width:g} {height:g}"' + closing
    else:
        tag_with_box = tag
    return svg.replace(tag, _SVG_ROOT_SIZE_ATTR_STRIP_RE.sub("", tag_with_box), 1)


def _rasterize_svg(data: bytes) -> Image.Image:
    """Render SVG bytes to an RGBA Pillow image no larger than FAVICON_MAX_PX."""
    svg = _prepare_svg_size(data.decode("utf-8", errors="replace"))
    png = resvg_py.svg_to_bytes(svg_string=svg, width=FAVICON_MAX_PX, skip_system_fonts=True)
    return Image.open(io.BytesIO(bytes(png)))


def _open_raster(data: bytes) -> Image.Image:
    """Open a raster image; for multi-frame ICO pick the largest frame."""
    image = Image.open(io.BytesIO(data))
    if image.format == "ICO":
        sizes = sorted(image.info.get("sizes", []) or [image.size], key=lambda s: s[0] * s[1])
        image.size = sizes[-1]  # type: ignore[misc]  # Pillow ICO plugin: set before load() to choose a frame
    return image


def is_already_normalized(data: bytes) -> bool:
    """
    Whether ``data`` is already a universally renderable, appropriately sized favicon.

    PNG and JPEG within FAVICON_MAX_PX render everywhere without help, so rewriting them
    only costs writes (and re-encoding a tiny palette PNG as RGBA can even grow it).

    Args:
        data: Raw file content

    Returns:
        True if the bytes are a PNG/JPEG whose longest side is at most FAVICON_MAX_PX
    """
    if sniff_image_kind(data) not in (ImageKind.PNG, ImageKind.JPEG):
        return False
    try:
        with Image.open(io.BytesIO(data)) as image:
            return max(image.size) <= FAVICON_MAX_PX
    except (UnidentifiedImageError, ValueError, OSError):
        return False


def normalize_favicon_to_png(data: bytes) -> bytes | None:
    """
    Convert any supported favicon payload to an RGBA PNG fitted within FAVICON_MAX_PX.

    Images are only ever downscaled, never upscaled. Real format is sniffed from bytes,
    so PNGs mislabeled as SVG and ``ns0:``-prefixed SVGs are handled correctly.

    Args:
        data: Raw favicon bytes in any supported format

    Returns:
        PNG bytes, or None if the input is empty, too large, unsupported or undecodable
    """
    if not data or len(data) > FAVICON_MAX_INPUT_BYTES:
        return None
    kind = sniff_image_kind(data)
    if kind == ImageKind.UNKNOWN:
        return None

    try:
        image = _rasterize_svg(data) if kind == ImageKind.SVG else _open_raster(data)
        image.load()
        image = image.convert("RGBA")
        image.thumbnail((FAVICON_MAX_PX, FAVICON_MAX_PX), Image.Resampling.LANCZOS)
        out = io.BytesIO()
        image.save(out, format="PNG", optimize=True)
        return out.getvalue()
    except (UnidentifiedImageError, ValueError, OSError, Image.DecompressionBombError) as e:
        logger.warning("favicon_normalize_failed", kind=kind.value, error=str(e))
        return None
