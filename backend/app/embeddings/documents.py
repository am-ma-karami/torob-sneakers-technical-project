"""Build stable English model-level facts without prices, offers or inferred values."""

from dataclasses import dataclass
from typing import Any

from app.embeddings.spec import RECIPE_VERSION, fingerprint

SUMMARY_FIELDS = (
    "categories", "gender", "release_year", "terrain", "uses", "arch_support", "width_options",
    "fit_label", "fit_note", "plate", "foam", "upper_material", "outsole_material",
    "removable_insole", "orthotic_friendly", "reflective", "pros", "cons",
)


@dataclass(frozen=True)
class ProductDocument:
    shoe_id: int
    name: str
    image_url: str | None
    facts: dict[str, Any]
    statements: list[str]
    content_hash: str


def render(value):
    if isinstance(value, dict):
        return "; ".join(f"{key}: {render(v)}" for key, v in sorted(value.items()) if v is not None)
    if isinstance(value, (list, tuple)):
        return ", ".join(map(render, value))
    if isinstance(value, bool):
        return "yes" if value else "no"
    return str(value).replace("|", ";")


def build_document(shoe, measurements):
    attributes = {key: shoe.summary[key] for key in SUMMARY_FIELDS
                  if shoe.summary.get(key) is not None and shoe.summary[key] != ""}
    metrics = {
        m.key: {"value": m.value, "unit": m.unit, "provenance": m.provenance}
        for m in sorted(measurements, key=lambda m: m.key)
    }
    facts = {"name": shoe.name, "brand": shoe.brand, "attributes": attributes, "measurements": metrics}
    statements = [f"{key.replace('_', ' ')}: {render(value)}." for key, value in attributes.items()]
    for key, metric in metrics.items():
        provenance = metric["provenance"]
        origin = str(provenance.get("origin") or "origin unknown").replace("_", " ")
        source = provenance.get("source") or "source unknown"
        method = provenance.get("methodology_version") or provenance.get("method_version")
        context = f"{origin}; source {source}"
        if method:
            context += f"; method {method}"
        if provenance.get("uncertain"):
            context += "; uncertain estimate"
        statements.append(f"{key.replace('_', ' ')}: {metric['value']} {metric['unit']} ({context}).")
    return ProductDocument(
        shoe.id, shoe.name, shoe.summary.get("image_url"), facts, statements,
        fingerprint({"recipe": RECIPE_VERSION, "facts": facts}),
    )
