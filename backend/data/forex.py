FOREX_PAIRS = [
    {"id": "EURUSD", "base": "EUR", "quote": "USD", "name": "Euro / Dollaro",        "yahoo": "EURUSD=X", "rank": 1,  "keywords": ["euro", "eur", "usd", "dollar", "eurusd", "ecb"]},
    {"id": "USDJPY", "base": "USD", "quote": "JPY", "name": "Dollaro / Yen",          "yahoo": "USDJPY=X", "rank": 2,  "keywords": ["yen", "jpy", "usdjpy", "boj", "bank of japan"]},
    {"id": "GBPUSD", "base": "GBP", "quote": "USD", "name": "Sterlina / Dollaro",     "yahoo": "GBPUSD=X", "rank": 3,  "keywords": ["sterling", "pound", "gbp", "gbpusd", "boe"]},
    {"id": "USDCAD", "base": "USD", "quote": "CAD", "name": "Dollaro / Dollaro CA",   "yahoo": "USDCAD=X", "rank": 4,  "keywords": ["canadian", "cad", "usdcad", "loonie", "bank of canada"]},
    {"id": "AUDUSD", "base": "AUD", "quote": "USD", "name": "Dollaro AU / Dollaro",   "yahoo": "AUDUSD=X", "rank": 5,  "keywords": ["australian", "aud", "audusd", "rba"]},
    {"id": "USDCHF", "base": "USD", "quote": "CHF", "name": "Dollaro / Franco SV",    "yahoo": "USDCHF=X", "rank": 6,  "keywords": ["franc", "chf", "usdchf", "snb", "swiss"]},
    {"id": "NZDUSD", "base": "NZD", "quote": "USD", "name": "Dollaro NZ / Dollaro",   "yahoo": "NZDUSD=X", "rank": 7,  "keywords": ["nzd", "nzdusd", "rbnz", "new zealand"]},
    {"id": "EURGBP", "base": "EUR", "quote": "GBP", "name": "Euro / Sterlina",        "yahoo": "EURGBP=X", "rank": 8,  "keywords": ["eurgbp", "euro", "sterling", "pound"]},
    {"id": "EURJPY", "base": "EUR", "quote": "JPY", "name": "Euro / Yen",             "yahoo": "EURJPY=X", "rank": 9,  "keywords": ["eurjpy", "euro", "yen"]},
    {"id": "GBPJPY", "base": "GBP", "quote": "JPY", "name": "Sterlina / Yen",        "yahoo": "GBPJPY=X", "rank": 10, "keywords": ["gbpjpy", "sterling", "yen", "pound"]},
]

_pair_index = {p["id"]: p for p in FOREX_PAIRS}


def get_all() -> list[dict]:
    return FOREX_PAIRS


def get_by_id(pair_id: str) -> dict | None:
    return _pair_index.get(pair_id)


def get_ids() -> list[str]:
    return [p["id"] for p in FOREX_PAIRS]
