"""Money, source identity and stock are validated before persistence and on output."""

import hashlib
import json
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Annotated, Any, Literal

from pydantic import (
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field,
    computed_field,
    field_serializer,
    field_validator,
    model_validator,
)

from app.core.commerce import public_https, retailer_url
from app.core.config import get_settings

Availability = Literal["in_stock", "out_of_stock", "unknown"]
Currency = Annotated[str, Field(pattern=r"^[A-Z]{3}$")]
Country = Annotated[str, Field(pattern=r"^[A-Z]{2}$")]
# ISO 4217 currencies supported by the commerce contract; no implicit currency conversion.
CURRENCIES = frozenset(
    "AED AFN ALL AMD ANG AOA ARS AUD AWG AZN BAM BBD BDT BGN BHD BIF BMD BND BOB BOV BRL BSD BTN BWP BYN BZD CAD CDF CHE CHF CHW CLF CLP CNY COP COU CRC CUP CVE CZK DJF DKK DOP DZD EGP ERN ETB EUR FJD FKP GBP GEL GHS GIP GMD GNF GTQ GYD HKD HNL HTG HUF IDR ILS INR IQD IRR ISK JMD JOD JPY KES KGS KHR KMF KPW KRW KWD KYD KZT LAK LBP LKR LRD LSL LYD MAD MDL MGA MKD MMK MNT MOP MRU MUR MVR MWK MXN MXV MYR MZN NAD NGN NIO NOK NPR NZD OMR PAB PEN PGK PHP PKR PLN PYG QAR RON RSD RUB RWF SAR SBD SCR SDG SEK SGD SHP SLE SOS SRD SSP STN SVC SYP SZL THB TJS TMT TND TOP TRY TTD TWD TZS UAH UGX USD USN UYI UYU UYW UZS VED VES VND VUV WST XAF XCD XCG XOF XPF YER ZAR ZMW ZWG".split()
)


class StockItem(BaseModel):
    model_config = ConfigDict(extra="forbid")
    size: str = Field(min_length=1, max_length=40)
    size_system: Literal["EU", "US_M", "US_W", "UK", "CM", "JP"]
    width: str | None = Field(default=None, max_length=40)
    availability: Availability = "unknown"


class VariantResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    key: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=240)
    colors: list[str] = Field(default_factory=list, max_length=32)
    image_url: str | None = Field(default=None, max_length=8192)
    source: str = Field(min_length=1, max_length=240)
    source_id: str | int | None = None

    @field_validator("image_url")
    @classmethod
    def image_link(cls, value):
        if value is not None and not public_https(value):
            raise ValueError("Invalid variant image URL")
        return value


class OfferInput(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    source: str = Field(min_length=1, max_length=80, pattern=r"^[A-Za-z0-9_-]+$")
    external_id: str = Field(min_length=1, max_length=2048)
    source_product_id: str = Field(min_length=1, max_length=240)
    retailer_id: str = Field(min_length=1, max_length=120)
    retailer: str = Field(min_length=1, max_length=200)
    variant_key: str | None = Field(default=None, min_length=1, max_length=100)
    price: Decimal = Field(ge=0, max_digits=14, decimal_places=4)
    currency: Currency
    country: Country | None = None  # Source market, NOT a claim about delivery coverage.
    shipping_countries: list[Country] = Field(default_factory=list, max_length=250)
    url: str = Field(min_length=1, max_length=8192)
    snapshot: AwareDatetime | None = None
    checked_at: AwareDatetime | None = None
    expires_at: AwareDatetime | None = None
    availability: Availability = "unknown"
    inventory: list[StockItem] = Field(default_factory=list, max_length=500)
    sizes_available_raw: Any = None
    available_widths_raw: Any = None
    colorway: str | None = Field(default=None, max_length=240)
    live_verified: Literal[False] = False

    @field_validator("price", mode="before")
    @classmethod
    def monetary_input(cls, value):
        if isinstance(value, bool):
            raise ValueError("Boolean is not a price")
        return value

    @field_validator("currency")
    @classmethod
    def currency_code(cls, value):
        if value not in CURRENCIES:
            raise ValueError("Unsupported ISO 4217 currency")
        return value

    @model_validator(mode="after")
    def validate_offer(self):
        json.dumps([self.sizes_available_raw, self.available_widths_raw], allow_nan=False)
        retailer_url(self.url, self.source, self.retailer_id)
        inventory: dict[tuple[str, str, str], StockItem] = {}
        for item in self.inventory:
            identity = (item.size_system, item.size, item.width or "")
            if identity in inventory and inventory[identity].availability != item.availability:
                raise ValueError("Conflicting size inventory")
            inventory[identity] = item
        self.inventory = [inventory[key] for key in sorted(inventory)]
        self.shipping_countries = sorted(set(self.shipping_countries))
        self.price = self.price.quantize(Decimal("0.0001"))
        if self.snapshot:
            self.snapshot = self.snapshot.astimezone(timezone.utc)
            if self.snapshot > datetime.now(timezone.utc) + timedelta(minutes=5):
                raise ValueError("Snapshot cannot be in the future")
        if self.checked_at and self.checked_at > datetime.now(timezone.utc) + timedelta(minutes=5):
            raise ValueError("Stock check cannot be in the future")
        if self.checked_at is None:
            self.availability = "unknown"
            self.expires_at = None
        else:
            self.checked_at = self.checked_at.astimezone(timezone.utc)
            maximum = self.checked_at + timedelta(hours=get_settings().offer_ttl_hours)
            self.expires_at = min(self.expires_at, maximum) if self.expires_at else maximum
            if self.expires_at < self.checked_at:
                raise ValueError("Expiry precedes stock check")
        return self

    @computed_field  # type: ignore[prop-decorator]
    @property
    def key(self) -> str:
        identity = "\x00".join([self.source, self.retailer_id, self.external_id])
        return hashlib.sha256(identity.encode()).hexdigest()

    @computed_field  # type: ignore[prop-decorator]
    @property
    def price_amount(self) -> str:
        return format(self.price, "f")

    @field_serializer("price", when_used="json")
    def price_number(self, value: Decimal) -> float:
        return float(value)  # Legacy UI compatibility; price_amount preserves decimal precision.


class OfferResponse(OfferInput):
    model_config = ConfigDict(extra="ignore", allow_inf_nan=False)
    freshness: Literal["fresh", "expired", "unknown"] = "unknown"
    observed_availability: Availability = "unknown"


class OffersQuery(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    currency: Currency | None = None
    country: Country | None = None
    ships_to: Country | None = None
    retailer_id: str | None = Field(default=None, max_length=120)
    source: str | None = Field(default=None, max_length=80)
    variant_key: str | None = Field(default=None, max_length=100)
    availability: Availability | None = None
    fresh_only: bool = False
    size: str | None = Field(default=None, min_length=1, max_length=40)
    size_system: Literal["EU", "US_M", "US_W", "UK", "CM", "JP"] | None = None
    width: str | None = Field(default=None, max_length=40)
    price_min: Decimal | None = Field(default=None, ge=0, max_digits=14, decimal_places=4)
    price_max: Decimal | None = Field(default=None, ge=0, max_digits=14, decimal_places=4)
    sort: Literal["retailer", "price", "recent"] = "retailer"
    page: int = Field(default=1, ge=1, le=10000)
    page_size: int = Field(default=20, ge=1, le=48)

    @model_validator(mode="after")
    def filters(self):
        if (
            self.sort == "price" or self.price_min is not None or self.price_max is not None
        ) and not self.currency:
            raise ValueError("Currency is required for offer price comparisons")
        if self.currency is not None and self.currency not in CURRENCIES:
            raise ValueError("Unsupported ISO 4217 currency")
        if self.price_min is not None and self.price_max is not None and self.price_min > self.price_max:
            raise ValueError("Minimum must not exceed maximum")
        if bool(self.size) != bool(self.size_system):
            raise ValueError("Size and size_system must be provided together")
        return self


class OffersResponse(BaseModel):
    items: list[OfferResponse]
    total: int
    page: int
    page_size: int
    pages: int
