from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.core.admin_auth import (
    ADMIN_COOKIE,
    login,
    require_admin,
    require_csrf,
    session_payload,
    validate_origin,
)
from app.core.commerce import retailer_url
from app.db.session import get_session
from app.models.catalog import Offer
from app.repositories.analytics import store_metrics
from app.schemas.analytics import ImpressionBatch, LoginInput, TrafficQuery
from app.services.analytics import offers_for_references, record_traffic

router = APIRouter(prefix="/api")
DB = Annotated[Session, Depends(get_session)]


@router.post("/admin/login")
def admin_login(body: LoginInput, request: Request, response: Response, session: DB):
    return login(session, request, body.username.casefold(), body.password, response)


@router.get("/admin/session")
def admin_session(request: Request, session: DB):
    user, identity = require_admin(session, request)
    return session_payload(user, request.cookies[ADMIN_COOKIE], identity.expires_at)


@router.post("/admin/logout", status_code=204)
def admin_logout(request: Request, session: DB):
    _, identity = require_admin(session, request)
    require_csrf(request)
    session.delete(identity)
    session.commit()
    response = Response(status_code=204)
    response.delete_cookie(ADMIN_COOKIE, path="/api", httponly=True, samesite="strict")
    return response


@router.get("/admin/analytics/stores")
def admin_analytics(query: Annotated[TrafficQuery, Query()], request: Request, session: DB):
    require_admin(session, request)
    return store_metrics(session, query)


@router.post("/analytics/store-impressions", status_code=202)
def store_impressions(body: ImpressionBatch, request: Request, response: Response, session: DB):
    validate_origin(request)
    response.headers["Cache-Control"] = "no-store"
    recorded = record_traffic(session, request, response, offers_for_references(session, body.items))
    return {"recorded": recorded}


@router.get("/out/{shoe_id}/{offer_key}")
def store_click(
    shoe_id: Annotated[int, Path(gt=0)],
    offer_key: Annotated[str, Path(pattern=r"^[a-f0-9]{64}$")],
    request: Request,
    session: DB,
):
    offer = session.get(Offer, (shoe_id, offer_key))
    if offer is None:
        raise HTTPException(404, "این پیشنهاد پیدا نشد")
    try:
        url = retailer_url(offer.payload["url"], offer.source, offer.retailer_id)
    except (ValueError, KeyError):
        raise HTTPException(404, "لینک فروشگاه در دسترس نیست") from None
    response = RedirectResponse(
        url, status_code=302, headers={"Cache-Control": "no-store", "Referrer-Policy": "no-referrer"}
    )
    # Browser prefetches and embedded subresources are not purchase-button clicks.
    if (
        "prefetch" not in request.headers.get("purpose", "").lower()
        and "prefetch" not in request.headers.get("sec-purpose", "").lower()
        and request.headers.get("sec-fetch-mode", "navigate") == "navigate"
    ):
        record_traffic(session, request, response, [offer], kind="click")
    return response
