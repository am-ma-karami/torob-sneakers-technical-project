from math import isfinite
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

FACET_KEYS = (
    "brand",
    "category",
    "activity",
    "family",
    "color",
    "terrain",
    "arch",
    "width",
    "fit",
    "plate",
    "foam",
    "upper",
    "geometry",
    "year",
)


class MetricInput(BaseModel):
    model_config = ConfigDict(extra="allow")
    value: float
    unit: str
    source: str
    origin: str

    @field_validator("value")
    @classmethod
    def finite(cls, value):
        if not isfinite(value):
            raise ValueError("Measurement must be finite")
        return value


class SummaryInput(BaseModel):
    model_config = ConfigDict(extra="allow", allow_inf_nan=False)
    shoe_id: int = Field(gt=0)
    name: str = Field(min_length=1, max_length=240)
    brand: str = Field(min_length=1, max_length=120)
    categories: list[str] = Field(min_length=1, max_length=20)
    weight_g: float | None = Field(None, ge=0, le=3000)
    msrp_usd: float | None = Field(None, ge=0)
    runrepeat_score: float | None = Field(None, ge=0, le=100)
    heel_stack_mm: float | None = Field(None, ge=0)
    forefoot_stack_mm: float | None = Field(None, ge=0)
    drop_mm: float | None = None
    interior_forefoot_width_mm: float | None = Field(None, ge=0)


class ShoeInput(BaseModel):
    model_config = ConfigDict(extra="allow")
    shoe_id: int = Field(gt=0)
    slug: str = Field(min_length=1, max_length=240, pattern=r"^[a-z0-9-]+$")
    summary: dict[str, Any]
    metrics: dict[str, MetricInput]
    visualization: dict[str, Any]

    @model_validator(mode="after")
    def identity(self):
        self.summary = SummaryInput.model_validate(self.summary).model_dump()
        if self.summary.get("shoe_id") != self.shoe_id:
            raise ValueError("Summary ID differs from record ID")
        if not self.summary.get("name") or not self.summary.get("brand"):
            raise ValueError("Name and brand are required")
        return self


class CatalogQuery(BaseModel):
    model_config = ConfigDict(extra="forbid")
    q: str = Field("", max_length=160)
    brand: list[str] = Field(default_factory=list, max_length=16)
    category: list[str] = Field(default_factory=list, max_length=16)
    activity: list[str] = Field(default_factory=list, max_length=16)
    family: list[str] = Field(default_factory=list, max_length=16)
    color: list[str] = Field(default_factory=list, max_length=16)
    terrain: list[str] = Field(default_factory=list, max_length=16)
    arch: list[str] = Field(default_factory=list, max_length=16)
    width: list[str] = Field(default_factory=list, max_length=16)
    fit: list[str] = Field(default_factory=list, max_length=16)
    plate: list[str] = Field(default_factory=list, max_length=16)
    foam: list[str] = Field(default_factory=list, max_length=16)
    upper: list[str] = Field(default_factory=list, max_length=16)
    geometry: list[str] = Field(default_factory=list, max_length=16)
    year: list[str] = Field(default_factory=list, max_length=16)
    weight_min: float | None = Field(None, ge=0, le=3000)
    weight_max: float | None = Field(None, ge=0, le=3000)
    price_min: float | None = Field(None, ge=0, le=10000)
    price_max: float | None = Field(None, ge=0, le=10000)
    score_min: float | None = Field(None, ge=0, le=100)
    drop_min: float | None = Field(None, ge=-20, le=60)
    drop_max: float | None = Field(None, ge=-20, le=60)
    heel_min: float | None = Field(None, ge=0, le=100)
    heel_max: float | None = Field(None, ge=0, le=100)
    forefoot_min: float | None = Field(None, ge=0, le=100)
    forefoot_max: float | None = Field(None, ge=0, le=100)
    internal_width_min: float | None = Field(None, ge=0, le=200)
    internal_width_max: float | None = Field(None, ge=0, le=200)
    sort: Literal["relevance", "score", "weight", "price", "newest", "name"] = "relevance"
    page: int = Field(1, ge=1, le=10000)
    page_size: int = Field(18, ge=1, le=48)

    @model_validator(mode="after")
    def ranges(self):
        for prefix in ["weight", "price", "drop", "heel", "forefoot", "internal_width"]:
            low, high = getattr(self, prefix + "_min"), getattr(self, prefix + "_max")
            if low is not None and high is not None and low > high:
                raise ValueError("Minimum must not exceed maximum")
        for key in FACET_KEYS:
            if any(len(value) > 220 for value in getattr(self, key)):
                raise ValueError("Facet value too long")
        return self


class FinderRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    category: str = Field("running-shoes", max_length=100)
    width: Literal["any", "wide", "regular"] = "any"
    weight: Literal["any", "light", "balanced"] = "any"
    cushion: Literal["any", "soft", "firm"] = "any"


class Card(BaseModel):
    shoe_id: int
    name: str
    brand: str
    slug: str
    categories: list[str]
    family: str
    variants_count: int
    catalog_image_url: str | None = None
    image_url: str | None = None
    colors: list[str] = Field(default_factory=list)
    release_year: int | None = None
    weight_g: float | None = None
    msrp_usd: float | None = None
    runrepeat_score: float | None = None
    heel_stack_mm: float | None = None
    forefoot_stack_mm: float | None = None
    drop_mm: float | None = None
    geometry_status: str


class CatalogResponse(BaseModel):
    items: list[Card]
    total: int
    page: int
    page_size: int
    pages: int


class DetailResponse(BaseModel):
    model_config = ConfigDict(extra="allow")
    shoe_id: int
    slug: str
    summary: dict[str, Any]
    metrics: dict[str, Any]
    visualization: dict[str, Any]
    variants: list[dict[str, Any]]
    offers: list[dict[str, Any]]
