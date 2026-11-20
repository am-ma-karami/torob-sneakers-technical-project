from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.session import get_session
from app.repositories.catalog import CatalogRepository
from app.schemas.catalog import CatalogQuery, CatalogResponse, DetailResponse, FinderRequest
from app.services.catalog import CatalogService

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
def detail(slug: str, repo: Repo):
    return CatalogService(repo).detail(slug)


@router.get("/compare")
def compare(repo: Repo, ids: Annotated[list[int], Query(min_length=1, max_length=4)]):
    return CatalogService(repo).compare(ids)


@router.post("/finder")
def finder(preferences: FinderRequest, repo: Repo):
    return CatalogService(repo).finder(preferences)
