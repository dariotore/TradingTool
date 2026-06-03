COMMODITIES = [
    {"id": "GC=F",  "symbol": "GOLD",   "name": "Oro",            "unit": "$/oz",     "rank": 1, "keywords": ["gold", "oro", "xau", "precious metal", "bullion"]},
    {"id": "SI=F",  "symbol": "SILVER", "name": "Argento",         "unit": "$/oz",     "rank": 2, "keywords": ["silver", "argento", "xag"]},
    {"id": "CL=F",  "symbol": "WTI",    "name": "Petrolio WTI",    "unit": "$/barile", "rank": 3, "keywords": ["crude oil", "wti", "petrolio", "opec"]},
    {"id": "NG=F",  "symbol": "GAS",    "name": "Gas Naturale",    "unit": "$/MMBtu",  "rank": 4, "keywords": ["natural gas", "gas naturale", "lng"]},
    {"id": "BZ=F",  "symbol": "BRENT",  "name": "Petrolio Brent",  "unit": "$/barile", "rank": 5, "keywords": ["brent", "crude", "oil", "opec"]},
    {"id": "HG=F",  "symbol": "COPPER", "name": "Rame",            "unit": "$/lb",     "rank": 6, "keywords": ["copper", "rame", "industrial metal"]},
    {"id": "PL=F",  "symbol": "PLAT",   "name": "Platino",         "unit": "$/oz",     "rank": 7, "keywords": ["platinum", "platino"]},
    {"id": "ZW=F",  "symbol": "WHEAT",  "name": "Grano",           "unit": "$/bushel", "rank": 8, "keywords": ["wheat", "grano", "grain", "cereals"]},
]

_index = {c["id"]: c for c in COMMODITIES}


def get_all() -> list[dict]:
    return COMMODITIES


def get_by_id(cid: str) -> dict | None:
    return _index.get(cid)


def get_ids() -> list[str]:
    return [c["id"] for c in COMMODITIES]
