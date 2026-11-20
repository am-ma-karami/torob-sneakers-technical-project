import re
import unicodedata

CATEGORIES = {
    "running-shoes": "دویدن",
    "sneakers": "روزمره",
    "training-shoes": "تمرین",
    "basketball-shoes": "بسکتبال",
    "hiking-shoes": "طبیعت‌گردی",
    "walking-shoes": "پیاده‌روی",
    "tennis-shoes": "تنیس",
    "track-spikes": "دو و میدانی",
    "hiking-boots": "بوت کوهنوردی",
    "hiking-sandals": "صندل طبیعت‌گردی",
    "cross-country-shoes": "دو صحرانوردی",
}
ALIASES = {
    "نیو بالانس": "new balance",
    "نیو بالنس": "new balance",
    "نیوبالنس": "new balance",
    "آندر آرمور": "under armour",
    "اندر آرمور": "under armour",
    "مرل": "merrell",
    "کلمبیا": "columbia",
    "پگاسوس": "pegasus",
    "نیمباس": "nimbus",
    "نوابلاست": "novablast",
    "باندی": "bondi",
    "کلیفتون": "clifton",
    "گوست": "ghost",
    "نایک": "nike",
    "نايک": "nike",
    "نایکی": "nike",
    "ادیداس": "adidas",
    "آدیداس": "adidas",
    "اسیکس": "asics",
    "آسیکس": "asics",
    "هوکا": "hoka",
    "بروکس": "brooks",
    "سالومون": "salomon",
    "ساکونی": "saucony",
    "نیوبالانس": "new balance",
    "نیوبلنس": "new balance",
    "پوما": "puma",
    "ریبوک": "reebok",
    "اسکچرز": "skechers",
    "سفید": "white",
    "مشکی": "black",
    "سیاه": "black",
    "آبی": "blue",
    "قرمز": "red",
    "سبز": "green",
    "صورتی": "pink",
    "خاکستری": "grey",
    "زرد": "yellow",
    "دویدن": "running",
    "روزمره": "sneakers",
    "بسکتبال": "basketball",
    "تنیس": "tennis",
    "پیاده روی": "walking",
    "طبیعت گردی": "hiking",
    "تمرین": "training",
}
COLORS = [
    "black",
    "white",
    "grey",
    "blue",
    "red",
    "green",
    "pink",
    "yellow",
    "orange",
    "purple",
    "silver",
    "brown",
    "beige",
    "navy",
    "teal",
    "gold",
]


def normalize(text: str) -> str:
    text = unicodedata.normalize("NFKC", text).translate(
        str.maketrans("يىك۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "ییک01234567890123456789")
    )
    text = re.sub(r"[^\w\s]", " ", text.casefold().replace("\u200c", " ").replace("_", " "))
    text = " ".join(text.split())
    for alias, value in sorted(ALIASES.items(), key=lambda pair: -len(pair[0])):
        text = re.sub(r"(?<!\w)" + re.escape(alias) + r"(?!\w)", value, text)
    return text


def split_values(value) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return list(dict.fromkeys(str(v).strip() for v in value if v is not None))
    return list(dict.fromkeys(v.strip() for v in re.split(r"\s*[|,]\s*", str(value)) if v.strip()))


def model_family(name: str, brand: str) -> str:
    """Conservative browsing group only; IDs never derive from this heuristic."""
    short = re.sub(r"^" + re.escape(brand) + r"\s+", "", name, flags=re.I)
    return re.sub(r"\s+v?\d+(?:\.\d+)?(?:\s+(?:GTX|WP))?$", "", short, flags=re.I) or short


def color_labels(name: str) -> list[str]:
    value = normalize(name).replace("gray", "grey")
    return [c for c in COLORS if re.search(r"\b" + c + r"\b", value)]
