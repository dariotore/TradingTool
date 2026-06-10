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
     "yahoo": "GC=F", "rank": 12,
     "keywords": ["gold", "xau", "xauusd", "oro", "precious metal", "bullion",
                  "real yield", "safe haven", "treasury yield", "dxy", "dollar index"]},
    # ── EUR crosses ───────────────────────────────────────────────────────────
    {"id": "EURCHF", "base": "EUR", "quote": "CHF", "name": "Euro / Franco SV",
     "yahoo": "EURCHF=X", "rank": 13,
     "keywords": ["eurchf", "euro", "franc", "chf", "ecb", "snb", "swiss"]},
    {"id": "EURCAD", "base": "EUR", "quote": "CAD", "name": "Euro / Dollaro CA",
     "yahoo": "EURCAD=X", "rank": 14,
     "keywords": ["eurcad", "euro", "canadian", "cad", "ecb", "bank of canada", "oil"]},
    {"id": "EURAUD", "base": "EUR", "quote": "AUD", "name": "Euro / Dollaro AU",
     "yahoo": "EURAUD=X", "rank": 15,
     "keywords": ["euraud", "euro", "australian", "aud", "ecb", "rba"]},
    {"id": "EURNZD", "base": "EUR", "quote": "NZD", "name": "Euro / Dollaro NZ",
     "yahoo": "EURNZD=X", "rank": 16,
     "keywords": ["eurnzd", "euro", "nzd", "new zealand", "ecb", "rbnz"]},
    # ── GBP crosses ───────────────────────────────────────────────────────────
    {"id": "GBPCHF", "base": "GBP", "quote": "CHF", "name": "Sterlina / Franco SV",
     "yahoo": "GBPCHF=X", "rank": 17,
     "keywords": ["gbpchf", "sterling", "pound", "franc", "chf", "boe", "snb"]},
    {"id": "GBPCAD", "base": "GBP", "quote": "CAD", "name": "Sterlina / Dollaro CA",
     "yahoo": "GBPCAD=X", "rank": 18,
     "keywords": ["gbpcad", "sterling", "pound", "canadian", "cad", "boe", "bank of canada"]},
    {"id": "GBPAUD", "base": "GBP", "quote": "AUD", "name": "Sterlina / Dollaro AU",
     "yahoo": "GBPAUD=X", "rank": 19,
     "keywords": ["gbpaud", "sterling", "pound", "australian", "aud", "boe", "rba"]},
    {"id": "GBPNZD", "base": "GBP", "quote": "NZD", "name": "Sterlina / Dollaro NZ",
     "yahoo": "GBPNZD=X", "rank": 20,
     "keywords": ["gbpnzd", "sterling", "pound", "nzd", "new zealand", "boe", "rbnz"]},
    # ── AUD crosses ───────────────────────────────────────────────────────────
    {"id": "AUDCAD", "base": "AUD", "quote": "CAD", "name": "Dollaro AU / Dollaro CA",
     "yahoo": "AUDCAD=X", "rank": 21,
     "keywords": ["audcad", "australian", "canadian", "rba", "bank of canada", "oil", "commodities"]},
    {"id": "AUDCHF", "base": "AUD", "quote": "CHF", "name": "Dollaro AU / Franco SV",
     "yahoo": "AUDCHF=X", "rank": 22,
     "keywords": ["audchf", "australian", "franc", "chf", "rba", "snb", "risk sentiment"]},
    {"id": "AUDNZD", "base": "AUD", "quote": "NZD", "name": "Dollaro AU / Dollaro NZ",
     "yahoo": "AUDNZD=X", "rank": 23,
     "keywords": ["audnzd", "australian", "new zealand", "rba", "rbnz", "pacific"]},
    # ── JPY crosses ───────────────────────────────────────────────────────────
    {"id": "CADJPY", "base": "CAD", "quote": "JPY", "name": "Dollaro CA / Yen",
     "yahoo": "CADJPY=X", "rank": 24,
     "keywords": ["cadjpy", "canadian", "yen", "boj", "bank of canada", "oil", "risk"]},
    {"id": "CHFJPY", "base": "CHF", "quote": "JPY", "name": "Franco SV / Yen",
     "yahoo": "CHFJPY=X", "rank": 25,
     "keywords": ["chfjpy", "franc", "yen", "snb", "boj", "safe haven", "risk off"]},
    {"id": "NZDJPY", "base": "NZD", "quote": "JPY", "name": "Dollaro NZ / Yen",
     "yahoo": "NZDJPY=X", "rank": 26,
     "keywords": ["nzdjpy", "nzd", "yen", "rbnz", "boj", "risk appetite", "risk sentiment"]},
    # ── Remaining crosses ─────────────────────────────────────────────────────
    {"id": "CADCHF", "base": "CAD", "quote": "CHF", "name": "Dollaro CA / Franco SV",
     "yahoo": "CADCHF=X", "rank": 27,
     "keywords": ["cadchf", "canadian", "franc", "chf", "bank of canada", "snb", "oil"]},
    {"id": "NZDCAD", "base": "NZD", "quote": "CAD", "name": "Dollaro NZ / Dollaro CA",
     "yahoo": "NZDCAD=X", "rank": 28,
     "keywords": ["nzdcad", "nzd", "canadian", "rbnz", "bank of canada", "commodities"]},
    {"id": "NZDCHF", "base": "NZD", "quote": "CHF", "name": "Dollaro NZ / Franco SV",
     "yahoo": "NZDCHF=X", "rank": 29,
     "keywords": ["nzdchf", "nzd", "franc", "chf", "rbnz", "snb", "risk"]},
    # ── Emerging / popular ────────────────────────────────────────────────────
    {"id": "USDMXN", "base": "USD", "quote": "MXN", "name": "Dollaro / Peso MX",
     "yahoo": "USDMXN=X", "rank": 30,
     "keywords": ["usdmxn", "mexican peso", "mxn", "mexico", "banxico", "emerging market"]},
]

_pair_index = {p["id"]: p for p in FOREX_PAIRS}


def get_all() -> list[dict]:
    return FOREX_PAIRS


def get_by_id(pair_id: str) -> dict | None:
    return _pair_index.get(pair_id)


def get_ids() -> list[str]:
    return [p["id"] for p in FOREX_PAIRS]
