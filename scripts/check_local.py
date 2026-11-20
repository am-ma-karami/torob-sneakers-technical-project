"""Read-only acceptance check against the running local application."""

import json
import urllib.parse
import urllib.request
from pathlib import Path

root = Path(__file__).resolve().parents[1]
base = "http://127.0.0.1:8000/api"


def get(path):
    with urllib.request.urlopen(base + path, timeout=10) as response:
        return json.load(response)


ready = get("/ready")
assert ready == {"status": "ready", "shoes": 1167}, ready
first = get("/catalog?page_size=48&sort=name")
items = list(first["items"])
for page in range(2, first["pages"] + 1):
    items.extend(get(f"/catalog?page_size=48&sort=name&page={page}")["items"])
expected = {s["shoe_id"] for s in json.loads((root / "shoes-ui.json").read_text())["shoes"]}
assert len(items) == len({s["shoe_id"] for s in items}) == 1167
assert {s["shoe_id"] for s in items} == expected
found = get("/catalog?" + urllib.parse.urlencode({"q": "نايكي پگاسوس ٤١"}))
assert any(s["slug"] == "nike-pegasus-41" for s in found["items"])
shoe = get("/shoes/adidas-adizero-evo-sl")
assert shoe["metrics"]["weight_g"]["value"] == 223
assert shoe["metrics"]["insole_thickness_mm"]["value"] == 2.4
assert shoe["metrics"]["outsole_thickness_mm"]["value"] == 1.6
assert shoe["metrics"]["midsole_firmness_asker_c"]["unit"] == "Asker C"
with urllib.request.urlopen("http://127.0.0.1:5173/", timeout=10) as response:
    assert response.status == 200
print("Local app ready: http://127.0.0.1:5173/")
print("All 1167 distinct original IDs verified through 25 paginated API responses.")
print("Persian/Arabic aliases, actual EVO SL measurements, and frontend HTTP verified.")
