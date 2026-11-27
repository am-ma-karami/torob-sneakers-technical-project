import hashlib
import json

MODEL_NAME = "openai/clip-vit-base-patch32"
MODEL_REVISION = "3d74acf9a28c67741b2f4f2ea7635f0aaf6f0268"
DIMENSIONS = 512
RECIPE_VERSION = "rad-shoe-clip-v1"
MODEL_SPEC = {
    "name": MODEL_NAME,
    "revision": MODEL_REVISION,
    "dimensions": DIMENSIONS,
    "recipe": RECIPE_VERSION,
    "text": "English sourced facts; lossless token chunks; normalized mean of normalized chunk features",
    "image": "Canonical primary product photo; pinned CLIP image processor; RGB",
    "normalization": "L2 unit float32; image and text remain separate",
}


def fingerprint(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False,
                                     separators=(",", ":"), allow_nan=False).encode()).hexdigest()


MODEL_KEY = fingerprint(MODEL_SPEC)
