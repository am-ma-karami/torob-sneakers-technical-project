from collections import Counter
from typing import Any

from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import Session

from app.core.taxonomy import CATEGORIES, normalize
from app.models.catalog import Measurement, Offer, Shoe, Variant
from app.schemas.catalog import FACET_KEYS, CatalogQuery
from app.services.presentation import reference_price


class CatalogRepository:
    def __init__(self, session: Session):
        self.session = session

    @staticmethod
    def conditions(query: CatalogQuery, exclude: str | None = None):
        conditions: list[Any] = []
        text = normalize(query.q)
        # LIKE values are bound parameters; escape wildcard characters so they remain literals.
        for token in text.split():
            escaped = token.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            conditions.append(Shoe.search_text.ilike("%" + escaped + "%", escape="\\"))
        for key in FACET_KEYS:
            values = getattr(query, key)
            if values and key != exclude:
                conditions.append(or_(*[Shoe.facets.contains({key: [v]}) for v in values]))
        for field, column in [
            ("weight", Shoe.weight),
            ("price", Shoe.price_usd),
            ("drop", Shoe.drop),
            ("heel", Shoe.heel),
            ("forefoot", Shoe.forefoot),
            ("internal_width", Shoe.internal_width),
        ]:
            low, high = getattr(query, field + "_min"), getattr(query, field + "_max")
            if low is not None:
                conditions.append(column >= low)
            if high is not None:
                conditions.append(column <= high)
        if query.score_min is not None:
            conditions.append(Shoe.score >= query.score_min)
        return conditions

    def catalog(self, query: CatalogQuery):
        where = self.conditions(query)
        total = self.session.scalar(select(func.count()).select_from(Shoe).where(*where)) or 0
        text = normalize(query.q)
        relevance = case(
            (func.lower(Shoe.name) == text, 0), (func.lower(Shoe.name).like(text + "%"), 1), else_=2
        )
        orders: dict[str, list[Any]] = {
            "relevance": [relevance, Shoe.score.desc().nullslast()],
            "score": [Shoe.score.desc().nullslast()],
            "weight": [Shoe.weight.asc().nullslast()],
            "price": [Shoe.price_usd.asc().nullslast()],
            "newest": [Shoe.summary["release_year"].as_integer().desc().nullslast()],
            "name": [Shoe.name.asc()],
        }
        order = orders[query.sort]
        rows = self.session.scalars(
            select(Shoe.summary)
            .where(*where)
            .order_by(*order, Shoe.id)
            .offset((query.page - 1) * query.page_size)
            .limit(query.page_size)
        ).all()
        return {
            "items": [dict(row, reference_price=reference_price(row)) for row in rows],
            "total": total,
            "page": query.page,
            "page_size": query.page_size,
            "pages": (total + query.page_size - 1) // query.page_size,
        }

    def facets(self, query: CatalogQuery):
        groups = {}
        # Disjunctive counts: OR inside a facet, AND across groups. Each group's counts
        # include all active constraints except itself, enabling useful multiselection.
        for key in FACET_KEYS:
            values = self.session.scalars(
                select(Shoe.facets[key]).where(*self.conditions(query, exclude=key))
            ).all()
            counts = Counter(value for row in values if row for value in set(row))
            groups[key] = [
                {"value": v, "label": CATEGORIES.get(v, v), "count": n}
                for v, n in sorted(counts.items(), key=lambda row: (-row[1], row[0]))
            ]
        return {"groups": groups, "count_mode": "disjunctive", "price_basis": "manufacturer MSRP, USD only"}

    def taxonomy(self):
        categories = self.session.scalars(select(Shoe.facets["category"])).all()
        counts = Counter(c for row in categories for c in row)
        return {
            "categories": [
                {"value": k, "label": CATEGORIES.get(k, k), "count": v} for k, v in counts.most_common()
            ],
            "brands": self.brand_options(),
            "total": sum(counts.values()),
        }

    def brand_options(self, category: str | None = None):
        query = select(Shoe.brand, func.count()).group_by(Shoe.brand).order_by(Shoe.brand)
        if category is not None:
            query = query.where(Shoe.facets.contains({"category": [category]}))
        return [
            {"value": brand, "label": brand, "count": count} for brand, count in self.session.execute(query)
        ]

    def details(self, identifiers: list[int] | None = None, slug: str | None = None):
        predicate = Shoe.id.in_(identifiers) if identifiers is not None else Shoe.slug == slug
        rows = self.session.execute(select(Shoe.id, Shoe.detail).where(predicate)).all()
        result = {ident: dict(detail, metrics={}, variants=[], offers=[]) for ident, detail in rows}
        if not result:
            return []
        for ident, key, provenance in self.session.execute(
            select(Measurement.shoe_id, Measurement.key, Measurement.provenance).where(
                Measurement.shoe_id.in_(result)
            )
        ):
            result[ident]["metrics"][key] = provenance
        tables: list[tuple[Any, str]] = [(Variant, "variants"), (Offer, "offers")]
        for table, field in tables:
            for ident, payload in self.session.execute(
                select(table.shoe_id, table.payload).where(table.shoe_id.in_(result)).order_by(table.key)
            ):
                result[ident][field].append(payload)
        return [result[i] for i in (identifiers or list(result)) if i in result]

    def finder_candidates(self, filters: CatalogQuery):
        return self.session.scalars(select(Shoe.summary).where(*self.conditions(filters))).all()

    def count(self):
        return self.session.scalar(select(func.count()).select_from(Shoe)) or 0

    def score_population(self, category):
        return self.session.scalars(
            select(Shoe.detail["scores"]["runrepeat"]["usage"]).where(
                Shoe.summary["categories"][0].as_string() == category
            )
        ).all()
