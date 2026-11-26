from typing import Any

from sqlalchemy import Float, case, cast, distinct, func, or_, select

from app.core.taxonomy import normalize
from app.models.admin import StoreTrafficDay as Event
from app.models.catalog import Offer, Shoe


def store_metrics(session, query):
    current = select(
        Offer.shoe_id,
        Offer.source,
        Offer.retailer_id,
        func.min(Offer.payload["retailer"].as_string()).label("retailer_name"),
        func.min(Offer.market).label("market"),
    ).where(Offer.source == query.source)
    current = current.group_by(Offer.shoe_id, Offer.source, Offer.retailer_id)
    # Keep historical merchant identities visible even if a future feed retires its listings.
    historical = select(
        Event.shoe_id,
        Event.source,
        Event.retailer_id,
        func.min(Event.retailer_name).label("retailer_name"),
        func.min(Event.market).label("market"),
    )
    historical = historical.where(Event.source == query.source).group_by(
        Event.shoe_id, Event.source, Event.retailer_id
    )
    union = current.union_all(historical).subquery()
    pairs = (
        select(
            union.c.shoe_id,
            union.c.source,
            union.c.retailer_id,
            func.min(union.c.retailer_name).label("retailer_name"),
            func.min(union.c.market).label("market"),
        )
        .group_by(union.c.shoe_id, union.c.source, union.c.retailer_id)
        .subquery()
    )
    views = func.count(distinct(case((Event.event_kind == "impression", Event.visitor_hash)))).label(
        "viewers"
    )
    clicks = func.count(distinct(case((Event.event_kind == "click", Event.visitor_hash)))).label("clickers")
    observations = (
        select(Event.shoe_id, Event.source, Event.retailer_id, views, clicks)
        .where(
            Event.source == query.source,
            Event.event_day >= query.start_date,
            Event.event_day <= query.end_date,
        )
        .group_by(Event.shoe_id, Event.source, Event.retailer_id)
        .subquery()
    )
    join = (
        (pairs.c.shoe_id == observations.c.shoe_id)
        & (pairs.c.source == observations.c.source)
        & (pairs.c.retailer_id == observations.c.retailer_id)
    )
    rows = (
        select(
            pairs,
            Shoe.slug,
            Shoe.name.label("shoe_name"),
            Shoe.brand,
            func.coalesce(observations.c.viewers, 0).label("viewers"),
            func.coalesce(observations.c.clickers, 0).label("clickers"),
        )
        .join(Shoe, Shoe.id == pairs.c.shoe_id)
        .outerjoin(observations, join)
    )
    if query.market:
        rows = rows.where(pairs.c.market == query.market)
    if query.retailer_id:
        rows = rows.where(pairs.c.retailer_id == query.retailer_id)
    for token in normalize(query.q).split():
        token = token.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        rows = rows.where(
            or_(
                Shoe.search_text.ilike("%" + token + "%", escape="\\"),
                func.lower(pairs.c.retailer_name).ilike("%" + token + "%", escape="\\"),
            )
        )
    if query.active_only:
        rows = rows.where(observations.c.viewers > 0)
    filtered = rows.subquery()
    total = session.scalar(select(func.count()).select_from(filtered)) or 0
    ctr = case(
        (filtered.c.viewers > 0, 100.0 * cast(filtered.c.clickers, Float) / filtered.c.viewers), else_=None
    )
    orders: dict[str, list[Any]] = {
        "views": [filtered.c.viewers.desc(), filtered.c.clickers.desc()],
        "clicks": [filtered.c.clickers.desc(), filtered.c.viewers.desc()],
        "ctr": [ctr.desc().nullslast(), filtered.c.viewers.desc()],
        "name": [filtered.c.shoe_name, filtered.c.retailer_name],
    }
    page = (
        session.execute(
            select(filtered)
            .order_by(*orders[query.sort], filtered.c.shoe_id, filtered.c.source, filtered.c.retailer_id)
            .offset((query.page - 1) * query.page_size)
            .limit(query.page_size)
        )
        .mappings()
        .all()
    )
    event_join = (
        (Event.shoe_id == filtered.c.shoe_id)
        & (Event.source == filtered.c.source)
        & (Event.retailer_id == filtered.c.retailer_id)
    )
    summary = (
        session.execute(
            select(views, clicks)
            .join(filtered, event_join)
            .where(Event.event_day >= query.start_date, Event.event_day <= query.end_date)
        )
        .mappings()
        .one()
    )
    active = session.scalar(select(func.count()).select_from(filtered).where(filtered.c.viewers > 0)) or 0
    retailers = (
        session.execute(
            select(pairs.c.retailer_id, func.min(pairs.c.retailer_name).label("name"))
            .group_by(pairs.c.retailer_id)
            .order_by(func.min(pairs.c.retailer_name))
        )
        .mappings()
        .all()
    )

    def rate(viewers, clickers):
        return round(clickers / viewers * 100, 1) if viewers else None

    return dict(
        items=[dict(row, ctr=rate(row["viewers"], row["clickers"])) for row in page],
        summary=dict(summary, ctr=rate(summary["viewers"], summary["clickers"]), active_pairs=active),
        total=total,
        page=query.page,
        page_size=query.page_size,
        pages=(total + query.page_size - 1) // query.page_size,
        retailers=[dict(row) for row in retailers],
        start_date=query.start_date,
        end_date=query.end_date,
        timezone="Asia/Tehran",
        definition="unique_browser_per_shoe_retailer_in_range",
    )
