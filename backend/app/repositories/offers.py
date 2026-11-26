from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import and_, case, func, not_, or_, select

from app.models.catalog import Offer
from app.schemas.offers import OffersQuery
from app.services.exchange_rates import rates_from_session
from app.services.offers import present_offer


def offer_conditions(query: OffersQuery, now: datetime | None = None):
    now = now or datetime.now(timezone.utc)
    fresh = and_(Offer.checked_at.is_not(None), Offer.expires_at.is_not(None), Offer.expires_at > now)
    clauses: list[Any] = []
    for name in ("currency", "country", "retailer_id", "source", "variant_key", "market"):
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
    rates = rates_from_session(session)
    toman_price = case(
        (Offer.currency == "IRT", Offer.price),
        (Offer.currency == "IRR", Offer.price / Decimal(10)),
        *[
            (Offer.currency == currency, Offer.price * quote.toman_per_unit)
            for currency, quote in rates.items()
        ],
        else_=None,
    )
    orders: dict[str, list[Any]] = {
        "price": [Offer.price],
        "recent": [Offer.checked_at.desc().nullslast()],
        "retailer": [Offer.retailer_id, Offer.source],
        "price_toman": [toman_price.asc().nullslast(), Offer.retailer_id],
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
        shoe_id=shoe_id,
        items=[present_offer(o, now, rates) for o in rows],
        total=total,
        page=query.page,
        page_size=query.page_size,
        pages=(total + query.page_size - 1) // query.page_size,
        market_counts={
            market: count
            for market, count in session.execute(
                select(Offer.market, func.count())
                .where(Offer.shoe_id == shoe_id, *([Offer.source == query.source] if query.source else []))
                .group_by(Offer.market)
            )
            if market is not None
        },
    )
