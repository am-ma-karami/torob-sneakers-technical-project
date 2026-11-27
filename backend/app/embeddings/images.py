"""Bounded download/cache of known canonical product photos, never arbitrary URLs."""

import hashlib
import json
import warnings
from datetime import datetime, timezone
from io import BytesIO
from urllib.parse import urlsplit

import httpx

MAX_IMAGE_BYTES = 10 * 1024 * 1024


class ImageSourceError(ValueError):
    pass


def validate_url(url, shoe_id):
    try:
        parts = urlsplit(url)
        port = parts.port
    except ValueError as error:
        raise ImageSourceError("invalid_primary_photo_url") from error
    if (parts.scheme != "https" or parts.hostname != "cdn.runrepeat.com" or parts.username
            or parts.password or port not in (None, 443) or parts.query or parts.fragment
            or not parts.path.startswith(f"/storage/gallery/product_primary/{shoe_id}/")
            or any(ord(c) <= 32 for c in url) or "\\" in url):
        raise ImageSourceError("unapproved_primary_photo_url")


def check_image(data):
    from PIL import Image, UnidentifiedImageError

    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(data)) as image:
                if image.width * image.height > 20_000_000 or min(image.size) < 32:
                    raise ImageSourceError("invalid_photo_dimensions")
                image.verify()
    except (OSError, UnidentifiedImageError, Image.DecompressionBombError, Image.DecompressionBombWarning) as error:
        raise ImageSourceError("invalid_photo_bytes") from error


def primary_photo(document, cache_dir, *, refresh=False):
    url = document.image_url
    if not url:
        raise ImageSourceError("missing_primary_photo")
    validate_url(url, document.shoe_id)
    key = hashlib.sha256(url.encode()).hexdigest()
    cache_dir.mkdir(parents=True, exist_ok=True)
    path = cache_dir / (key + ".image")
    meta_path = cache_dir / (key + ".json")
    if not refresh and path.exists() and meta_path.exists() and path.stat().st_size <= MAX_IMAGE_BYTES:
        data = path.read_bytes()
        try:
            meta = json.loads(meta_path.read_text())
        except (ValueError, OSError):
            meta = {}
        if len(data) <= MAX_IMAGE_BYTES and meta.get("url") == url and meta.get("sha256") == hashlib.sha256(data).hexdigest():
            check_image(data)
            return path, meta
    try:
        with httpx.Client(timeout=25, follow_redirects=False) as client:
            for _ in range(3):
                with client.stream("GET", url, headers={"User-Agent": "RADCatalogEmbeddings/1.0"}) as response:
                    if response.is_redirect:
                        url = str(response.url.join(response.headers["location"]))
                        validate_url(url, document.shoe_id)
                        continue
                    if response.status_code != 200:
                        raise ImageSourceError(f"photo_http_{response.status_code}")
                    if not response.headers.get("content-type", "").lower().startswith("image/"):
                        raise ImageSourceError("not_an_image_response")
                    data = b""
                    for chunk in response.iter_bytes():
                        data += chunk
                        if len(data) > MAX_IMAGE_BYTES:
                            raise ImageSourceError("photo_too_large")
                    check_image(data)
                    meta = dict(url=document.image_url, resolved_url=url,
                                sha256=hashlib.sha256(data).hexdigest(), bytes=len(data),
                                retrieved_at=datetime.now(timezone.utc).isoformat())
                    temp = path.with_suffix(".tmp")
                    temp.write_bytes(data)
                    temp.replace(path)
                    meta_path.write_text(json.dumps(meta, sort_keys=True))
                    return path, meta
            raise ImageSourceError("too_many_photo_redirects")
    except httpx.HTTPError as error:
        raise ImageSourceError("photo_network_error") from error
