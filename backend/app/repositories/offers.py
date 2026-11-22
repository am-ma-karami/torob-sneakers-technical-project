from datetime import datetime, timezone
from typing import Any

from sqlalchemy import and_, func, not_, or_, select

from app.models.catalog import Offer
from app.schemas.offers import OffersQuery
from app.services.offers import present_offer


def offer_conditions(query: OffersQuery, now: datetime | None = None):
    now = now or datetime.now(timezone.utc)
    fresh = and_(Offer.checked_at.is_not(None), Offer.expires_at.is_not(None), Offer.expires_at > now)
    clauses: list[Any] = []
    for name in ("currency", "country", "retailer_id", "source", "variant_key"):
        if (value := getattr(query, name)) is not None:
            clauses.append(getattr(Offer, name) == value)
    if query.ships_to:
        clauses.append(Offer.payload["shipping_countries"].contains([query.ships_to]))
    if query.price_min is not None:
        clauses.append(Offer.price >= query.price_min)
    if query.price_max is not None:
        clauses.append(Offer.price <= query.price_max)
    if query.fresh_only:
        clauses.append(fresh)
    if query.availability == "unknown":
        clauses.append(or_(Offer.availability == "unknown", not_(fresh)))
    elif query.availability:
        clauses.extend([Offer.availability == query.availability, fresh])
    if query.size or query.width:
        item: dict[str, Any] = {"availability": "in_stock"}
        if query.size:
            item.update(size=query.size, size_system=query.size_system)
        if query.width:
            item["width"] = query.width
        clauses.extend([fresh, Offer.availability == "in_stock", Offer.payload["inventory"].contains([item])])
    return clauses


def list_offers(session, shoe_id: int, query: OffersQuery):
    now = datetime.now(timezone.utc)
    where = [Offer.shoe_id == shoe_id, *offer_conditions(query, now)]
    total = session.scalar(select(func.count()).select_from(Offer).where(*where)) or 0
    orders: dict[str, list[Any]] = {
        "price": [Offer.price],
        "recent": [Offer.checked_at.desc().nullslast()],
        "retailer": [Offer.retailer_id, Offer.source],
    }
    order = orders[query.sort]
    rows = session.scalars(
        select(Offer)
        .where(*where)
        .order_by(*order, Offer.key)
        .offset((query.page - 1) * query.page_size)
        .limit(query.page_size)
    )
    return dict(
        items=[present_offer(o, now) for o in rows],
        total=total,
        page=query.page,
        page_size=query.page_size,
        pages=(total + query.page_size - 1) // query.page_size,
    )
