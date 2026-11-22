from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, Response
from pydantic import PositiveInt
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_session
from app.repositories.catalog import CatalogRepository
from app.schemas.catalog import CatalogQuery, CatalogResponse, DetailResponse, FinderRequest
from app.services.catalog import CatalogService, featured_catalog, score_context

router = APIRouter(prefix="/api")


def repository(session: Annotated[Session, Depends(get_session)]):
    return CatalogRepository(session)


Repo = Annotated[CatalogRepository, Depends(repository)]


@router.get("/health")
def health():
    return {"status": "ok"}


@router.get("/ready")
def ready(repo: Repo, response: Response):
    repo.session.execute(text("SELECT 1"))
    count = repo.count()
    if not count:
        response.status_code = 503
    return {"status": "ready" if count else "empty", "shoes": count}


@router.get("/catalog", response_model=CatalogResponse)
def catalog(query: Annotated[CatalogQuery, Query()], repo: Repo):
    return repo.catalog(query)


@router.get("/facets")
def facets(query: Annotated[CatalogQuery, Query()], repo: Repo):
    return repo.facets(query)


@router.get("/taxonomy")
def taxonomy(repo: Repo):
    return repo.taxonomy()


@router.get("/shoes/{slug}", response_model=DetailResponse)
def detail(slug: Annotated[str, Path(max_length=240, pattern=r"^[a-z0-9-]+$")], repo: Repo):
    return CatalogService(repo).detail(slug)


@router.get("/compare")
def compare(repo: Repo, ids: Annotated[list[PositiveInt], Query(min_length=1, max_length=4)]):
    return CatalogService(repo).compare(ids)


@router.post("/finder")
def finder(preferences: FinderRequest, repo: Repo):
    return CatalogService(repo).finder(preferences)


@router.get("/finder/brands")
def finder_brands(category: Annotated[str, Query(min_length=1, max_length=100)], repo: Repo):
    return CatalogService(repo).finder_brands(category)


@router.get("/featured")
def featured(repo: Repo):
    return featured_catalog(repo)


@router.get("/presentation")
def presentation():
    from app.services.presentation import reference_price

    settings = get_settings()
    return {
        "reference_price_enabled": reference_price({"msrp_usd": 1}, settings) is not None,
        "price_kind": "converted_msrp_reference",
        "price_currency": "IRT",
    }


@router.get("/shoes/{slug}/scores")
def scores(slug: Annotated[str, Path(max_length=240, pattern=r"^[a-z0-9-]+$")], repo: Repo):
    return score_context(repo, slug)
