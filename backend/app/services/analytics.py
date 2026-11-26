import logging
import secrets
from datetime import datetime

from sqlalchemy import or_, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import SQLAlchemyError

from app.core.admin_auth import TOKEN, VISITOR_COOKIE, current_admin, digest
from app.core.config import get_settings
from app.models.admin import StoreTrafficDay
from app.models.catalog import Offer
from app.schemas.analytics import TEHRAN


def opted_out(request):
    return request.headers.get("dnt") == "1" or request.headers.get("sec-gpc") == "1"


def visitor_cookie(request, response):
    if opted_out(request):
        return None
    token = request.cookies.get(VISITOR_COOKIE, "")
    if not TOKEN.fullmatch(token):
        token = secrets.token_urlsafe(32)
        response.set_cookie(
            VISITOR_COOKIE,
            token,
            httponly=True,
            samesite="lax",
            secure=get_settings().admin_cookie_secure,
            max_age=180 * 86400,
            path="/api",
        )
    return digest(token)


def record_traffic(session, request, response, offers, kind="impression"):
    if opted_out(request) or current_admin(session, request) is not None:
        return 0
    visitor = visitor_cookie(request, response)
    day = datetime.now(TEHRAN).date()
    values = {}
    for offer in offers:
        # Clicks ensure a matching visible-offer observation, keeping the funnel coherent.
        for event_kind in ("impression", "click") if kind == "click" else ("impression",):
            identity = (offer.shoe_id, offer.source, offer.retailer_id, event_kind)
            values[identity] = dict(
                shoe_id=offer.shoe_id,
                source=offer.source,
                retailer_id=offer.retailer_id,
                visitor_hash=visitor,
                event_kind=event_kind,
                event_day=day,
                retailer_name=offer.payload["retailer"],
                market=offer.market,
            )
    if not values:
        return 0
    try:
        # A telemetry write failure must not prevent an already validated outbound link.
        with session.begin_nested():
            result = session.execute(
                insert(StoreTrafficDay)
                .values(list(values.values()))
                .on_conflict_do_nothing()
                .returning(StoreTrafficDay.event_kind)
            )
            count = len(result.all())
        session.commit()
        return count
    except SQLAlchemyError as error:
        session.rollback()
        logging.getLogger("rad").warning("Store telemetry unavailable: %s", type(error).__name__)
        return 0


def offers_for_references(session, items):
    return session.scalars(
        select(Offer).where(
            or_(*[(Offer.shoe_id == item.shoe_id) & (Offer.key == item.offer_key) for item in items])
        )
    ).all()
