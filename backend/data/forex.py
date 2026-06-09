FOREX_PAIRS = [
    # ── 7 Major USD pairs ─────────────────────────────────────────────────────
    {"id": "EURUSD", "base": "EUR", "quote": "USD", "name": "Euro / Dollaro",
     "yahoo": "EURUSD=X", "rank": 1,
     "keywords": ["euro", "eur", "usd", "dollar", "eurusd", "ecb", "fed", "fomc", "european central bank"]},
    {"id": "GBPUSD", "base": "GBP", "quote": "USD", "name": "Sterlina / Dollaro",
     "yahoo": "GBPUSD=X", "rank": 2,
     "keywords": ["sterling", "pound", "gbp", "gbpusd", "boe", "bank of england"]},
    {"id": "USDJPY", "base": "USD", "quote": "JPY", "name": "Dollaro / Yen",
     "yahoo": "USDJPY=X", "rank": 3,
     "keywords": ["yen", "jpy", "usdjpy", "boj", "bank of japan", "japan"]},
    {"id": "USDCHF", "base": "USD", "quote": "CHF", "name": "Dollaro / Franco SV",
     "yahoo": "USDCHF=X", "rank": 4,
     "keywords": ["franc", "chf", "usdchf", "snb", "swiss", "national bank"]},
    {"id": "AUDUSD", "base": "AUD", "quote": "USD", "name": "Dollaro AU / Dollaro",
     "yahoo": "AUDUSD=X", "rank": 5,
     "keywords": ["australian", "aud", "audusd", "rba", "reserve bank australia"]},
    {"id": "USDCAD", "base": "USD", "quote": "CAD", "name": "Dollaro / Dollaro CA",
     "yahoo": "USDCAD=X", "rank": 6,
     "keywords": ["canadian", "cad", "usdcad", "loonie", "bank of canada", "oil", "crude"]},
    {"id": "NZDUSD", "base": "NZD", "quote": "USD", "name": "Dollaro NZ / Dollaro",
     "yahoo": "NZDUSD=X", "rank": 7,
     "keywords": ["nzd", "nzdusd", "rbnz", "new zealand", "kiwi"]},
    # ── 4 Active crosses ──────────────────────────────────────────────────────
    {"id": "EURJPY", "base": "EUR", "quote": "JPY", "name": "Euro / Yen",
     "yahoo": "EURJPY=X", "rank": 8,
     "keywords": ["eurjpy", "euro", "yen", "ecb", "boj"]},
    {"id": "GBPJPY", "base": "GBP", "quote": "JPY", "name": "Sterlina / Yen",
     "yahoo": "GBPJPY=X", "rank": 9,
     "keywords": ["gbpjpy", "sterling", "yen", "pound", "boe", "boj"]},
    {"id": "EURGBP", "base": "EUR", "quote": "GBP", "name": "Euro / Sterlina",
     "yahoo": "EURGBP=X", "rank": 10,
     "keywords": ["eurgbp", "euro", "sterling", "pound", "ecb", "boe"]},
    {"id": "AUDJPY", "base": "AUD", "quote": "JPY", "name": "Dollaro AU / Yen",
     "yahoo": "AUDJPY=X", "rank": 11,
     "keywords": ["audjpy", "australian", "yen", "rba", "boj", "risk sentiment", "risk appetite"]},
    # ── Gold ──────────────────────────────────────────────────────────────────
    {"id": "XAUUSD", "base": "XAU", "quote": "USD", "name": "Oro / Dollaro",
     "yahoo": "XAUUSD=X", "rank": 12,
     "keywords": ["gold", "xau", "xauusd", "oro", "precious metal", "bullion",
                  "real yield", "safe haven", "treasury yield", "dxy", "dollar index"]},
]

_pair_index = {p["id"]: p for p in FOREX_PAIRS}


def get_all() -> list[dict]:
    return FOREX_PAIRS


def get_by_id(pair_id: str) -> dict | None:
    return _pair_index.get(pair_id)


def get_ids() -> list[str]:
    return [p["id"] for p in FOREX_PAIRS]
