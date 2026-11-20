"""Build deterministic Persian review fields once; never translate on page load.

Inputs are public catalog excerpts. Uses a no-cost translation endpoint for prose,
with footwear terminology expanded before translation and editorial overrides after.
No credentials or private user content are transmitted. Resume is checkpointed.
"""

import concurrent.futures
import json
import re
import ssl
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "backend/app/content/reviews-fa.json"
OVERRIDES = ROOT / "backend/app/content/review-overrides-fa.json"
GLOSSARY = [
    ("non-gusseted tongue", "shoe tongue not attached at the sides"),
    ("gusseted tongue", "shoe tongue attached at the sides"),
    ("heel strikers", "runners landing on their heels"),
    ("forefoot strikers", "runners landing on the front of their feet"),
    ("heel counter", "heel stabilizer"),
    ("lockdown", "secure foot hold inside the shoe"),
    ("toebox", "toe space inside the shoe"),
    ("toe box", "toe space inside the shoe"),
    ("outsole", "outer sole of the shoe"),
    ("midsole", "middle sole of the shoe"),
    ("upper", "upper fabric of the shoe"),
    ("laces", "shoelaces"),
    ("tongue", "shoe tongue"),
    ("break-in", "initial adaptation"),
    ("ride", "feeling while running"),
    ("rocker", "curved rolling sole"),
]


def translate_batch(texts):
    prepared = []
    for text in texts:
        for old, new in GLOSSARY:
            text = re.sub(r"\b" + re.escape(old) + r"\b", new, text, flags=re.I)
        prepared.append(text)
    query = "\n".join(prepared)
    url = "https://translate.googleapis.com/translate_a/single?" + urllib.parse.urlencode(
        {"client": "gtx", "sl": "en", "tl": "fa", "dt": "t", "q": query}
    )
    for attempt in range(3):
        try:
            with urllib.request.urlopen(
                url, context=ssl.create_default_context(cafile="/etc/ssl/cert.pem"), timeout=45
            ) as response:
                result = json.load(response)
            translated = "".join(x[0] for x in result[0]).strip().split("\n")
            translated = [v.strip().translate(str.maketrans("يك", "یک")) for v in translated]
            if len(translated) != len(texts):
                if len(texts) == 1:
                    return [" ".join(translated)]
                middle = len(texts) // 2
                return translate_batch(texts[:middle]) + translate_batch(texts[middle:])
            return translated
        except Exception:
            if attempt == 2:
                raise
            time.sleep(5 * (attempt + 1))
    return []


def normalize_footwear(source, target):
    """Deterministic context-specific terminology; editorial overrides run last."""
    pairs = []
    if re.search(r"grip|traction", source, re.I):
        pairs += [("گرفتن", "چسبندگی"), ("کشش", "چسبندگی")]
    if re.search(r"stack", source, re.I):
        pairs += [("پشته", "زیره")]
    if re.search(r"plush", source, re.I):
        pairs += [("مخملی", "نرم"), ("شیک", "نرم")]
    if re.search(r"solid", source, re.I):
        pairs += [("جامد", "قابل اتکا")]
    if re.search(r"striker", source, re.I):
        pairs += [
            ("مهاجمان میانی پا", "دوندگان با فرود روی میانه پا"),
            ("مهاجمان جلوی پا", "دوندگان با فرود روی پنجه"),
        ]
    for old, new in pairs:
        target = target.replace(old, new)
    return target


def main():
    shoes = json.loads((ROOT / "shoes-ui.json").read_text())["shoes"]
    phrases = sorted(
        {
            v.strip()
            for s in shoes
            for key in ["pros", "cons"]
            for v in (s["summary"].get(key) or "").split(" | ")
            if v.strip()
        }
    )
    cache = json.loads(OUTPUT.read_text()) if OUTPUT.exists() else {}
    overrides = json.loads(OVERRIDES.read_text()) if OVERRIDES.exists() else {}
    cache = {source: normalize_footwear(source, target) for source, target in cache.items()}
    cache.update(overrides)
    pending = [s for s in phrases if s not in cache]
    batches = [pending[i : i + 40] for i in range(0, len(pending), 40)]
    OUTPUT.parent.mkdir(exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        for texts, translated in zip(batches, pool.map(translate_batch, batches)):
            for source, target in zip(texts, translated):
                if re.search("[\u0600-\u06ff]", target):
                    cache[source] = normalize_footwear(source, target)
            cache.update(json.loads(OVERRIDES.read_text()) if OVERRIDES.exists() else {})
            OUTPUT.write_text(json.dumps(cache, ensure_ascii=False, indent=2) + "\n")
            print(f"Translated {len(cache)}/{len(phrases)} public review phrases", flush=True)
    OUTPUT.write_text(json.dumps(cache, ensure_ascii=False, indent=2) + "\n")
    print("Stored translations complete; originals retained unchanged.")


if __name__ == "__main__":
    main()
