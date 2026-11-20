"""Copy a supplied dataset into this root, with all conflicts checked first."""

import argparse
import hashlib
import json
import shutil
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("source", type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
source = args.source.resolve()
files = sorted(p for p in source.iterdir() if p.is_file())
if not files:
    raise SystemExit("Source contains no files")


def digest(path):
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


report = []
for path in files:
    target = root / path.name
    checksum = digest(path)
    if target.exists() and digest(target) != checksum:
        raise SystemExit(f"Existing destination differs; no files copied: {path.name}")
    report.append({"name": path.name, "bytes": path.stat().st_size, "sha256": checksum})
for entry in report:
    path = source / entry["name"]
    target = root / entry["name"]
    if not target.exists():
        shutil.copy2(path, target)
    if target.stat().st_size != entry["bytes"] or digest(target) != entry["sha256"]:
        raise SystemExit(f"Copied file verification failed: {path.name}")
(root / ".local").mkdir(exist_ok=True)
(root / ".local/dataset-copy-report.json").write_text(json.dumps(report, indent=2) + "\n")
print(f"Copied/verified {len(report)} files; source unchanged.")
