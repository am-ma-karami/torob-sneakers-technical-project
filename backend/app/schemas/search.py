import math
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.core.taxonomy import CATEGORIES, normalize
from app.schemas.catalog import CatalogQuery


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class HardFilters(StrictModel):
    brand: list[str] = Field(default_factory=list, max_length=8)
    category: list[str] = Field(default_factory=list, max_length=5)
    weight_min: float | None = Field(None, ge=0, le=3000)
    weight_max: float | None = Field(None, ge=0, le=3000)
    drop_min: float | None = Field(None, ge=-20, le=60)
    drop_max: float | None = Field(None, ge=-20, le=60)
    weight_min_exclusive: bool = False
    weight_max_exclusive: bool = False
    drop_min_exclusive: bool = False
    drop_max_exclusive: bool = False

    @field_validator("weight_min", "weight_max", "drop_min", "drop_max", mode="before")
    @classmethod
    def numbers(cls, value):
        if isinstance(value, bool):
            raise ValueError("Boolean is not a measurement")
        if isinstance(value, str):
            value = value.translate(str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789"))
        return value

    @field_validator("brand", "category")
    @classmethod
    def unique(cls, values):
        if any(not v.strip() or len(v) > 120 for v in values):
            raise ValueError("Invalid facet")
        return list(dict.fromkeys(v.strip() for v in values))

    @field_validator("category")
    @classmethod
    def categories(cls, values):
        if any(v not in CATEGORIES for v in values):
            raise ValueError("Unsupported category")
        return values

    @model_validator(mode="after")
    def ranges(self):
        for key in ("weight_min", "weight_max", "drop_min", "drop_max"):
            if getattr(self, key + "_exclusive") and getattr(self, key) is None:
                raise ValueError("Exclusive boundary needs a numeric value")
        for field in ("weight", "drop"):
            low, high = getattr(self, field + "_min"), getattr(self, field + "_max")
            if low is not None and high is not None and (low > high or (low == high and (
                getattr(self, field + "_min_exclusive") or getattr(self, field + "_max_exclusive")
            ))):
                raise ValueError("Empty numerical interval")
        return self

    def active(self):
        return {k: v for k, v in self.model_dump().items() if v is not None and v != [] and v is not False}


class Preferences(StrictModel):
    weight: Literal["light", "balanced"] | None = None
    width: Literal["wide", "regular"] | None = None
    cushion: Literal["soft", "firm"] | None = None
    surface: Literal["road", "trail"] | None = None
    usage: Literal["jogging", "walking", "treadmill", "hiking", "gym", "all-day wear"] | None = None
    breathability: Literal["high"] | None = None
    durability: Literal["high"] | None = None
    flexibility: Literal["high"] | None = None
    cushioning: Literal["high"] | None = None
    priorities: dict[str, float] = Field(default_factory=dict, max_length=9)

    @model_validator(mode="after")
    def weights(self):
        for key, value in self.priorities.items():
            if key == "priorities" or key not in type(self).model_fields or getattr(self, key) is None:
                raise ValueError("Priority requires an active supported preference")
            if not math.isfinite(value) or not 0.25 <= value <= 4:
                raise ValueError("Priority must be 0.25–4")
        return self


class SearchIntent(StrictModel):
    hard_filters: HardFilters = Field(default_factory=lambda: HardFilters.model_validate({}))
    preferences: Preferences = Field(default_factory=Preferences)
    semantic_query: str = Field(default="", max_length=1800)
    unsupported_requirements: list[str] = Field(default_factory=list, max_length=10)
    evidence: dict[str, str] = Field(default_factory=dict, max_length=20)


class SearchRequest(StrictModel):
    model_config = ConfigDict(extra="forbid")
    q: str = Field(default="", max_length=1800)
    hard_filters: HardFilters = Field(default_factory=lambda: HardFilters.model_validate({}))
    preferences: Preferences = Field(default_factory=Preferences)
    filters: CatalogQuery | None = None
    mode: Literal["auto", "advanced", "advisor", "hybrid"] = "auto"
    limit: int = Field(default=9, ge=1, le=48)

    @field_validator("q")
    @classmethod
    def nonblank(cls, value):
        value = value.strip()
        return value

    @model_validator(mode="after")
    def modes(self):
        if self.filters is not None:
            active = self.filters.model_dump(exclude_defaults=True, exclude_none=True)
            supported = {"brand", "category", "weight_min", "weight_max", "drop_min", "drop_max"}
            if set(active) - supported:
                raise ValueError("Legacy filters support only brand/category/weight/drop; use typed criteria")
            HardFilters.model_validate(active)
        manual = bool(self.hard_filters.active() or self.preferences.model_dump(exclude_none=True, exclude={"priorities"})
                      or (self.filters is not None and self.filters.model_dump(exclude_defaults=True, exclude_none=True)))
        if not self.q and not manual:
            raise ValueError("Supply description or explicit criteria")
        if self.mode == "advanced" and self.q:
            raise ValueError("Advanced mode accepts manual criteria only")
        if self.mode == "advisor" and manual:
            raise ValueError("Advisor mode accepts natural language only")
        if self.mode == "hybrid" and (not self.q or not manual):
            raise ValueError("Hybrid mode needs both sources")
        return self


def canonical_brands(filters, known):
    mapping = {normalize(v): v for v in known}
    if any(normalize(v) not in mapping for v in filters.brand):
        raise ValueError("Unknown catalog brand")
    return filters.model_copy(update={"brand": list(dict.fromkeys(mapping[normalize(v)] for v in filters.brand))})
