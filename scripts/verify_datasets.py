"""Verify supplied local dataset files against the recorded copy manifest."""

import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
manifest = json.loads((root / "docs/dataset-verification.json").read_text())
for entry in manifest["files"]:
    path = root / entry["name"]
    if not path.is_file():
        raise SystemExit(f"Missing local dataset file: {path.name}")
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    if path.stat().st_size != entry["bytes"] or digest != entry["sha256"]:
        raise SystemExit(f"Checksum differs: {path.name}")
print(f"Verified {len(manifest['files'])} local dataset files.")
