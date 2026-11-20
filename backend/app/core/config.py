from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT / ".env", extra="ignore")
    database_url: str = "postgresql+psycopg://rad:change-me@127.0.0.1:5432/rad"
    data_dir: Path = Path(".")
    cors_origins: list[str] = ["http://127.0.0.1:5173", "http://localhost:5173"]
    environment: str = "development"
    rate_limit: int = 240

    @property
    def resolved_data_dir(self) -> Path:
        return self.data_dir if self.data_dir.is_absolute() else ROOT / self.data_dir


@lru_cache
def get_settings() -> Settings:
    return Settings()
