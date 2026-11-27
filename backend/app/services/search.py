"""Local same-space query encoder and unified recommendation entry point."""
import math
import threading
from functools import lru_cache
from types import SimpleNamespace

from app.core.config import ROOT
from app.embeddings.clip import ClipEncoder

_lock = threading.Lock()


class SearchUnavailable(ValueError):
    pass


@lru_cache(maxsize=1)
def encoder():
    return ClipEncoder(ROOT / ".local/embeddings/model", device="cpu", local_files_only=True)


@lru_cache(maxsize=128)
def query_vector(english):
    # Serialized local inference bounds memory/CPU use across concurrent requests.
    with _lock:
        clip = encoder()
        # Combined filters can exceed one CLIP context; preserve all tokens using
        # the same normalized chunk pooling as product specification embeddings.
        vector, _ = clip.text(SimpleNamespace(name="Footwear search", statements=[english]))
    if len(vector) != 512 or not all(math.isfinite(v) for v in vector):
        raise SearchUnavailable("invalid_query_vector")
    return vector


def search(session, request):
    from app.services.recommendations import search as recommend
    return recommend(session, request, query_vector)
