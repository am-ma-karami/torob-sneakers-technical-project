from datetime import datetime
from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT / ".env", extra="ignore")
    database_url: str = "postgresql+psycopg://rad:change-me@127.0.0.1:5432/rad"
    data_dir: Path = Path(".")
    cors_origins: list[str] = ["http://127.0.0.1:5173", "http://localhost:5173"]
    environment: str = "development"
    rate_limit: int = 240
    rate_limit_backend: str = Field(default="memory", pattern=r"^(memory|proxy)$")
    offer_ttl_hours: int = Field(default=24, ge=1, le=168)
    retailer_domains: dict[str, list[str]] = Field(default_factory=dict)
    fx_auto_refresh: bool = False
    fx_refresh_seconds: int = Field(default=3600, ge=300, le=86400)
    fx_stale_hours: int = Field(default=24, ge=1, le=168)
    admin_session_hours: int = Field(default=12, ge=1, le=168)
    admin_cookie_secure: bool = False
    reference_usd_toman: float | None = Field(default=None, gt=0, allow_inf_nan=False)
    reference_rate_at: datetime | None = None

    @property
    def resolved_data_dir(self) -> Path:
        return self.data_dir if self.data_dir.is_absolute() else ROOT / self.data_dir


@lru_cache
def get_settings() -> Settings:
    return Settings()
