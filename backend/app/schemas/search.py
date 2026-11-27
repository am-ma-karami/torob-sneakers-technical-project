from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.catalog import CatalogQuery


class SearchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    q: str = Field(min_length=1, max_length=1800)
    filters: CatalogQuery = Field(default_factory=lambda: CatalogQuery.model_validate({}))
    limit: int = Field(default=24, ge=1, le=48)

    @field_validator("q")
    @classmethod
    def nonblank(cls, value):
        value = value.strip()
        if not value:
            raise ValueError("Search cannot be blank")
        return value
