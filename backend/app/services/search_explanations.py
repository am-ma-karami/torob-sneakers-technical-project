"""One grounded sentence; rank similarity is not a guarantee of suitability."""
import re

from app.core.taxonomy import normalize


def explain(summary, query, english, channels):
    text = normalize(query + " " + english)
    evidence = []
    # Don't turn negative preferences into positive matches.
    negated = re.search(r"\b(not|no|without|avoid)\b|بدون|نمی|نباش", text)
    if not negated:
        terrain = str(summary.get("terrain") or "").lower()
        if any(word in text for word in ("asphalt", "road", "آسفالت", "جاده")) and terrain == "road":
            evidence.append("کاربری جاده‌ای آن با اشاره‌ات به مسیر آسفالتی هم‌راستاست")
        if any(word in text for word in ("trail", "تریل", "ناهموار")) and "trail" in terrain:
            evidence.append("کاربری تریل آن با درخواست مسیر ناهموار ارتباط دارد")
        if any(word in text for word in ("light", "سبک", "weight", "وزن")) and summary.get("weight_g") is not None:
            evidence.append(f"برای بررسی خواسته‌ات دربارهٔ وزن، وزن ثبت‌شدهٔ آن {summary['weight_g']:g} گرم است")
        if not evidence and any(word in text for word in ("running", "دویدن")) and "running-shoes" in summary.get("categories", []):
            evidence.append("این مدل در دستهٔ دویدن است که در درخواستت مطرح کردی")
    if evidence:
        return " و ".join(evidence[:2]) + "."
    if normalize(summary["name"]) in text:
        return "نام این مدل مستقیماً با نامی که در درخواستت آوردی تطبیق دارد."
    if "image" in channels:
        return "شباهت ظاهری با توصیفت در انتخاب این مدل نقش داشته؛ تناسب دقیق را در مشخصات محصول بررسی کن."
    if "text" in channels:
        return "توصیف و مشخصات این مدل از گزینه‌های نزدیک به متن تو بوده؛ جزئیات را در صفحهٔ محصول بررسی کن."
    return "این مدل بر اساس تطبیق واژه‌های درخواستت پیدا شده؛ مشخصاتش را برای انتخاب نهایی بررسی کن."
