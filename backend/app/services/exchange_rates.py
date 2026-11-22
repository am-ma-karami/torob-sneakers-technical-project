"""Latest retrieved free-market quotes. Never replace a good quote with a failed fetch."""

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from html.parser import HTMLParser

import httpx
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.models.catalog import ExchangeRate

PROFILES = {"USD": "price_dollar_rl", "EUR": "price_eur", "GBP": "price_gbp", "AUD": "price_aud"}


class QuoteParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.price_depth = 0
        self.price_parts: list[str] = []
        self.cell: list[str] | None = None
        self.cells: list[str] = []

    def handle_starttag(self, tag, attrs):
        if self.price_depth:
            self.price_depth += 1
        elif dict(attrs).get("data-col") == "info.last_trade.PDrCotVal":
            self.price_depth = 1
        if tag == "td":
            self.cell = []

    def handle_data(self, data):
        if self.price_depth:
            self.price_parts.append(data)
        if self.cell is not None:
            self.cell.append(data)

    def handle_endtag(self, tag):
        if self.price_depth:
            self.price_depth -= 1
        if tag == "td" and self.cell is not None:
            self.cells.append(" ".join(" ".join(self.cell).split()))
            self.cell = None


def parse_quote(html: str) -> tuple[Decimal, str]:
    parser = QuoteParser()
    parser.feed(html)
    if "واحد پولی" not in html or "ریال" not in html:
        raise ValueError("Unconfirmed source units")
    values = []
    for part in parser.price_parts:
        cleaned = part.strip().translate(str.maketrans("۰۱۲۳۴۵۶۷۸۹٬", "0123456789,"))
        if cleaned:
            try:
                values.append(Decimal(cleaned.replace(",", "")))
            except InvalidOperation:
                raise ValueError("Invalid source price") from None
    if not values or len(set(values)) != 1 or not values[0].is_finite() or not 0 < values[0] < 100_000_000:
        raise ValueError("Ambiguous source quote")
    try:
        position = parser.cells.index("زمان ثبت آخرین نرخ")
        source_label = parser.cells[position + 1]
    except (ValueError, IndexError):
        raise ValueError("Missing source quote time") from None
    if not source_label or source_label in ("-", "—") or len(source_label) > 120:
        raise ValueError("Invalid source time")
    return values[0] / Decimal(10), source_label  # TGJU profile units are explicitly IRR.


def save_quotes(quotes):
    with SessionLocal.begin() as session:
        for quote in quotes:
            statement = insert(ExchangeRate).values(**quote)
            session.execute(
                statement.on_conflict_do_update(
                    index_elements=["currency"],
                    set_={k: statement.excluded[k] for k in quote if k != "currency"},
                    where=statement.excluded.fetched_at > ExchangeRate.fetched_at,
                )
            )


async def refresh_rates():
    async with httpx.AsyncClient(
        timeout=15, follow_redirects=False, headers={"User-Agent": "RAD/0.1 price-reference"}
    ) as client:

        async def fetch(currency, profile):
            url = "https://www.tgju.org/profile/" + profile
            response = await client.get(url)
            response.raise_for_status()
            if len(response.content) > 2_000_000:
                raise ValueError("Quote response exceeds limit")
            rate, label = parse_quote(response.text)
            return dict(
                currency=currency,
                toman_per_unit=rate,
                source="TGJU · بازار آزاد",
                source_url=url,
                source_time_label=label,
                fetched_at=datetime.now(timezone.utc),
            )

        results = await asyncio.gather(*(fetch(c, p) for c, p in PROFILES.items()), return_exceptions=True)
    quotes = [r for r in results if isinstance(r, dict)]
    if quotes:
        await asyncio.to_thread(save_quotes, quotes)
    failures = [type(r).__name__ for r in results if isinstance(r, BaseException)]
    if failures:
        logging.getLogger("rad").warning("Exchange-rate refresh failures: %s", ", ".join(failures))
    return quotes


async def refresh_loop():
    while True:
        try:
            await refresh_rates()
        except asyncio.CancelledError:
            raise
        except Exception as error:
            logging.getLogger("rad").warning("Exchange-rate refresh unavailable: %s", type(error).__name__)
        await asyncio.sleep(get_settings().fx_refresh_seconds)


def rates_from_session(session):
    return {row.currency: row for row in session.scalars(select(ExchangeRate))}


def converted_price(price: Decimal | None, currency: str | None, rates, now=None):
    if price is None or currency is None:
        return {"price_toman": None, "conversion": None}
    now = now or datetime.now(timezone.utc)
    if currency in ("IRT", "IRR"):
        rate = Decimal(1) if currency == "IRT" else Decimal("0.1")
        conversion = dict(
            kind="native_toman" if currency == "IRT" else "rial_to_toman", rate_toman_per_unit=str(rate)
        )
    else:
        quote = rates.get(currency)
        if quote is None:
            return {"price_toman": None, "conversion": None}
        rate = quote.toman_per_unit
        conversion = dict(
            kind="free_market",
            rate_toman_per_unit=str(rate),
            source=quote.source,
            source_url=quote.source_url,
            source_time_label=quote.source_time_label,
            fetched_at=quote.fetched_at.isoformat(),
            stale=quote.fetched_at < now - timedelta(hours=get_settings().fx_stale_hours),
        )
    return {
        "price_toman": int((price * rate).quantize(Decimal(1), rounding=ROUND_HALF_UP)),
        "conversion": conversion,
    }


if __name__ == "__main__":
    quotes = asyncio.run(refresh_rates())
    print(
        "Exchange rates refreshed:",
        ", ".join(q["currency"] for q in quotes) or "none; retained last good quotes",
    )
    if len(quotes) != len(PROFILES):
        raise SystemExit(1)
