"""Operator-managed outbound domains. Feed contents cannot grant themselves trust."""

import ipaddress
from urllib.parse import parse_qs, urlsplit

from app.core.config import get_settings

# Exact hosts only, including the affiliate networks actually used by these sources.
# Adding a feed requires reviewing its retailer/redirect domains here or in deployment config.
CJ = ("www.kqzyfj.com", "www.jdoqocy.com", "www.dpbolvw.net", "www.anrdoezrs.net", "www.tkqlhce.com")
RETAILERS = {
    "RunRepeat:526": ("runningxpert.com",),
    "RunRepeat:69": ("www.amazon.de",),
    "RunRepeat:581": ("www.awin1.com", "www.adidas.de"),
    "RunRepeat:287": ("prf.hn", "www.sportsshoes.com"),
    "RunRepeat:724": ("www.awin1.com", "www.sizeofficial.de"),
    "RunRepeat:485": ("sportsdir.prf.hn", "de.sportsdirect.com"),
    "RunRepeat:572": ("www.awin1.com", "www.365rider.com"),
    "RunRepeat:388": ("prf.hn", "www.asics.com"),
    "RunRepeat:493": ("saucony.prf.hn", "www.saucony.com"),
    "RunRepeat:549": ("bjd.i-run.de", "www.i-run.de"),
    "RunRepeat:198": ("www.runningwarehouse.de",),
    "RunRepeat:516": ("newbalanceemea.pxf.io", "www.newbalance.de"),
    "RunRepeat:462": ("www.awin1.com", "www.hardloop.de"),
    "RunRepeat:1341": ("www.awin1.com", "www.laufbar.de"),
    "RunRepeat:427": (*CJ, "eu.puma.com"),
    "RunRepeat:1226": ("www.awin1.com", "modivo.de"),
    "RunRepeat:418": ("www.awin1.com", "www.hoka.com"),
    "RunRepeat:592": ("www.awin1.com", "www.on.com"),
    "RunRepeat:700": ("www.awin1.com", "www.humanic.net"),
    "RunRepeat:280": ("www.ebay.de",),
    "RunRepeat:355": ("merrell.prf.hn", "www.merrell.com"),
    "SoleHunt:DICK'S Sporting Goods": (*CJ, "www.dickssportinggoods.com"),
}


def public_https(value: str) -> bool:
    try:
        parsed = urlsplit(value)
        host = parsed.hostname or ""
        if (
            parsed.scheme != "https"
            or not host
            or parsed.username
            or parsed.password
            or parsed.port not in (None, 443)
            or any(ord(c) <= 32 for c in value)
            or "\\" in value
            or host.endswith((".local", ".localhost", ".internal"))
            or host == "localhost"
            or "." not in host
        ):
            return False
        try:
            ipaddress.ip_address(host)
            return False  # Outbound links are DNS names from an explicit registry, never IP literals.
        except ValueError:
            return True
    except ValueError:
        return False


def retailer_url(value: str, source: str, retailer_id: str) -> str:
    hosts = get_settings().retailer_domains.get(f"{source}:{retailer_id}")
    allowed = tuple(hosts) if hosts is not None else RETAILERS.get(f"{source}:{retailer_id}", ())
    if not public_https(value) or urlsplit(value).hostname not in allowed:
        raise ValueError("Unapproved retailer URL")
    # Do not allow a trusted redirect host to carry an explicitly unrelated destination.
    for key, destinations in parse_qs(urlsplit(value).query).items():
        if key.lower() in {"url", "ued", "destination", "redirect", "redirect_url", "murl"}:
            for destination in destinations:
                if not public_https(destination) or urlsplit(destination).hostname not in allowed:
                    raise ValueError("Unapproved redirect destination")
    return value
