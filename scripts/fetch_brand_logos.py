"""Discover public logo candidates for review; do not guess SVG paths or recolor marks."""

import concurrent.futures
import json
import re
import ssl
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
QUERIES = {
    "ASICS": "ASICS logo",
    "Saucony": "Saucony logo",
    "HOKA": "Hoka One One logo",
    "Brooks": "Brooks Sports logo",
    "On": "On running logo",
    "Salomon": "Salomon Group logo",
    "Mizuno": "Mizuno logo",
    "Altra": "Altra Running logo",
    "Merrell": "Merrell logo",
    "Skechers": "Skechers logo",
    "La Sportiva": "La Sportiva logo",
    "Topo Athletic": "Topo Athletic logo",
    "KIPRUN": "Kiprun logo",
    "ANTA": "Anta Sports logo",
    "Diadora": "Diadora logo",
    "KEEN": "Keen footwear logo",
    "Inov8": "Inov-8 logo",
    "Vibram FiveFingers": "Vibram logo",
    "Vivobarefoot": "Vivobarefoot logo",
    "Xero Shoes": "Xero Shoes logo",
    "Scarpa": "Scarpa shoe logo",
    "TYR": "TYR Sport logo",
    "Teva": "Teva footwear logo",
    "Allbirds": "Allbirds logo",
    "K-Swiss": "K-Swiss logo",
    "Converse": "Converse logo",
    "VEJA": "Veja sneakers logo",
    "Vans": "Vans logo",
    "DC": "DC Shoes logo",
    "HEYDUDE": "Heydude shoes logo",
    "NOBULL": "Nobull brand logo",
    "Columbia": "Columbia Sportswear logo",
    "LOWA": "Lowa Sportschuhe logo",
    "Salewa": "Salewa logo",
    "Timberland": "Timberland company logo",
    "Danner": "Danner footwear logo",
    "Asolo": "Asolo footwear logo",
    "Wilson": "Wilson Sporting Goods logo",
    "Babolat": "Babolat logo",
}
CONTEXT = ssl.create_default_context(cafile="/etc/ssl/cert.pem")


def lookup(item):
    brand, query = item
    params = {
        "action": "query",
        "format": "json",
        "generator": "search",
        "gsrsearch": query + " filetype:svg",
        "gsrnamespace": 6,
        "gsrlimit": 3,
        "prop": "imageinfo",
        "iiprop": "url|extmetadata",
    }
    req = urllib.request.Request(
        "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(params),
        headers={"User-Agent": "RADFootwearAssetResearch/1.0 (local educational catalog)"},
    )
    try:
        with urllib.request.urlopen(req, context=CONTEXT, timeout=22) as response:
            data = json.load(response)
        candidates = []
        for p in data.get("query", {}).get("pages", {}).values():
            info = p.get("imageinfo", [{}])[0]
            meta = info.get("extmetadata", {})

            def clean(k):
                return re.sub("<[^>]*>", "", meta.get(k, {}).get("value", ""))

            candidates.append(
                {
                    "title": p["title"],
                    "url": info.get("url"),
                    "page": info.get("descriptionurl"),
                    "license": clean("LicenseShortName"),
                    "author": clean("Artist"),
                    "description": clean("ImageDescription")[:600],
                }
            )
        return brand, candidates
    except Exception as exc:
        return brand, {"error": type(exc).__name__}


if __name__ == "__main__":
    output = ROOT / ".local/brand-logo-candidates.json"
    results = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        for brand, items in pool.map(lookup, QUERIES.items()):
            results[brand] = items
            print(
                brand,
                [(p["title"], p["license"]) for p in items] if isinstance(items, list) else items,
                flush=True,
            )
            output.write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n")
