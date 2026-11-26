from datetime import date, datetime, timedelta
from typing import Literal
from zoneinfo import ZoneInfo

from pydantic import BaseModel, ConfigDict, Field, model_validator

TEHRAN = ZoneInfo("Asia/Tehran")


class LoginInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    username: str = Field(min_length=3, max_length=80, pattern=r"^[A-Za-z0-9_.-]+$")
    password: str = Field(min_length=1, max_length=256)


class OfferReference(BaseModel):
    model_config = ConfigDict(extra="forbid")
    shoe_id: int = Field(gt=0)
    offer_key: str = Field(pattern=r"^[a-f0-9]{64}$")


class ImpressionBatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    items: list[OfferReference] = Field(min_length=1, max_length=24)


class TrafficQuery(BaseModel):
    model_config = ConfigDict(extra="forbid")
    start_date: date | None = None
    end_date: date | None = None
    q: str = Field(default="", max_length=160)
    retailer_id: str | None = Field(default=None, max_length=120)
    market: Literal["iran", "foreign"] | None = None
    source: str = Field(default="ShoeStoreLinks", min_length=1, max_length=80)
    sort: Literal["views", "clicks", "ctr", "name"] = "views"
    active_only: bool = False
    page: int = Field(default=1, ge=1, le=10000)
    page_size: int = Field(default=25, ge=1, le=100)

    @model_validator(mode="after")
    def dates(self):
        today = datetime.now(TEHRAN).date()
        self.end_date = self.end_date or today
        self.start_date = self.start_date or self.end_date - timedelta(days=29)
        if self.start_date > self.end_date or (self.end_date - self.start_date).days > 365:
            raise ValueError("بازهٔ تاریخ باید مرتب و حداکثر یک سال باشد")
        if self.end_date > today:
            raise ValueError("تاریخ پایان نمی‌تواند در آینده باشد")
        return self
