"""Unit tests for favicon normalization (pure logic, no network or database)."""

import io

import pytest
from PIL import Image

from app.core.constants import FAVICON_MAX_PX
from app.services.feeds.favicon_image import (
    ImageKind,
    is_generated_placeholder,
    normalize_favicon_to_png,
    sniff_image_kind,
)

pytestmark = pytest.mark.unit

PLACEHOLDER_SVG = (
    b'<ns0:svg xmlns:ns0="http://www.w3.org/2000/svg" width="100" height="100">'
    b'<ns0:rect width="100%" height="100%" fill="#ccc" />'
    b'<ns0:text x="50%" y="60%" font-size="100px" text-anchor="middle" fill="#000">G</ns0:text></ns0:svg>'
)
PREFIXED_SVG = (
    b'<ns0:svg xmlns:ns0="http://www.w3.org/2000/svg" viewBox="0 0 32 32">'
    b'<ns0:circle cx="16" cy="16" r="14" fill="#e11" /></ns0:svg>'
)
NO_VIEWBOX_SVG = (
    b'<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10"><rect width="20" height="10" fill="#0a0"/></svg>'
)


def _raster(size: tuple[int, int], fmt: str) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, "#3366ff").save(buf, format=fmt)
    return buf.getvalue()


def _decode(png: bytes) -> Image.Image:
    image = Image.open(io.BytesIO(png))
    image.load()
    return image


def test_sniff_ignores_declared_type_and_handles_prefixed_svg() -> None:
    assert sniff_image_kind(PREFIXED_SVG) == ImageKind.SVG
    assert sniff_image_kind(NO_VIEWBOX_SVG) == ImageKind.SVG
    assert sniff_image_kind(_raster((8, 8), "PNG")) == ImageKind.PNG
    assert sniff_image_kind(_raster((8, 8), "JPEG")) == ImageKind.JPEG
    assert sniff_image_kind(b"<html><body>404</body></html>") == ImageKind.UNKNOWN
    assert sniff_image_kind(b"") == ImageKind.UNKNOWN


def test_placeholder_detection() -> None:
    assert is_generated_placeholder(PLACEHOLDER_SVG)
    assert not is_generated_placeholder(PREFIXED_SVG)
    assert not is_generated_placeholder(_raster((8, 8), "PNG"))


def test_svg_rasterized_to_bounded_png() -> None:
    png = normalize_favicon_to_png(PREFIXED_SVG)
    assert png is not None
    image = _decode(png)
    assert image.format == "PNG"
    assert max(image.size) <= FAVICON_MAX_PX


def test_svg_without_viewbox_scales_and_keeps_aspect_ratio() -> None:
    png = normalize_favicon_to_png(NO_VIEWBOX_SVG)
    assert png is not None
    width, height = _decode(png).size
    assert max(width, height) <= FAVICON_MAX_PX
    assert width == pytest.approx(2 * height, abs=2)


def test_large_raster_downscaled_small_raster_not_upscaled() -> None:
    big = normalize_favicon_to_png(_raster((1024, 1024), "PNG"))
    small = normalize_favicon_to_png(_raster((32, 32), "PNG"))
    assert big is not None and small is not None
    assert _decode(big).size == (FAVICON_MAX_PX, FAVICON_MAX_PX)
    assert _decode(small).size == (32, 32)


def test_png_mislabeled_and_jpeg_inputs_become_png() -> None:
    jpeg = normalize_favicon_to_png(_raster((64, 64), "JPEG"))
    assert jpeg is not None and _decode(jpeg).format == "PNG"


def test_ico_uses_largest_frame() -> None:
    buf = io.BytesIO()
    Image.new("RGBA", (64, 64), "#ff0000").save(buf, format="ICO", sizes=[(16, 16), (64, 64)])
    png = normalize_favicon_to_png(buf.getvalue())
    assert png is not None
    assert _decode(png).size == (64, 64)


@pytest.mark.parametrize("data", [b"", b"not an image", b"<svg", b"\x89PNG\r\n\x1a\ntruncated"])
def test_garbage_returns_none(data: bytes) -> None:
    assert normalize_favicon_to_png(data) is None


@pytest.mark.parametrize(
    ("image_url", "expected"),
    [
        ("3f2a.png", "3f2a.png"),
        ("example.com", "example.com"),
        ("/storage/v1/object/public/favicons/abc.svg", "abc.svg"),
        ("storage/v1/object/public/favicons/storage/v1/object/public/favicons/abc", "abc"),
        ("https://cdn.example.com/icon.png", None),
        ("data:image/png;base64,AAAA", None),
        ("", None),
    ],
)
def test_storage_key_from_image_url(image_url: str, expected: str | None) -> None:
    from app.services.feeds.favicon_backfill import storage_key_from_image_url

    assert storage_key_from_image_url(image_url) == expected
