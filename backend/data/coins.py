import asyncio

# Candidate coins ordered by preference. At startup we verify each against
# Yahoo Finance and keep the first 30 that return a valid price.
CANDIDATE_COINS = [
    {"id": "bitcoin",           "symbol": "BTC",    "name": "Bitcoin",           "rank": 1},
    {"id": "ethereum",          "symbol": "ETH",    "name": "Ethereum",          "rank": 2},
    {"id": "ripple",            "symbol": "XRP",    "name": "XRP",               "rank": 3},
    {"id": "binancecoin",       "symbol": "BNB",    "name": "BNB",               "rank": 4},
    {"id": "solana",            "symbol": "SOL",    "name": "Solana",            "rank": 5},
    {"id": "dogecoin",          "symbol": "DOGE",   "name": "Dogecoin",          "rank": 6},
    {"id": "cardano",           "symbol": "ADA",    "name": "Cardano",           "rank": 7},
    {"id": "tron",              "symbol": "TRX",    "name": "TRON",              "rank": 8},
    {"id": "avalanche-2",       "symbol": "AVAX",   "name": "Avalanche",         "rank": 9},
    {"id": "chainlink",         "symbol": "LINK",   "name": "Chainlink",         "rank": 10},
    {"id": "polkadot",          "symbol": "DOT",    "name": "Polkadot",          "rank": 11},
    {"id": "litecoin",          "symbol": "LTC",    "name": "Litecoin",          "rank": 12},
    {"id": "bitcoin-cash",      "symbol": "BCH",    "name": "Bitcoin Cash",      "rank": 13},
    {"id": "stellar",           "symbol": "XLM",    "name": "Stellar",           "rank": 14},
    {"id": "monero",            "symbol": "XMR",    "name": "Monero",            "rank": 15},
    {"id": "cosmos",            "symbol": "ATOM",   "name": "Cosmos Hub",        "rank": 16},
    {"id": "near",              "symbol": "NEAR",   "name": "NEAR Protocol",     "rank": 17},
    {"id": "hedera-hashgraph",  "symbol": "HBAR",   "name": "Hedera",            "rank": 18},
    {"id": "uniswap",           "symbol": "UNI",    "name": "Uniswap",           "rank": 19},
    {"id": "internet-computer", "symbol": "ICP",    "name": "Internet Computer", "rank": 20},
    {"id": "ethereum-classic",  "symbol": "ETC",    "name": "Ethereum Classic",  "rank": 21},
    {"id": "aave",              "symbol": "AAVE",   "name": "Aave",              "rank": 22},
    {"id": "algorand",          "symbol": "ALGO",   "name": "Algorand",          "rank": 23},
    {"id": "filecoin",          "symbol": "FIL",    "name": "Filecoin",          "rank": 24},
    {"id": "aptos",             "symbol": "APT",    "name": "Aptos",             "rank": 25},
    {"id": "injective-protocol","symbol": "INJ",    "name": "Injective",         "rank": 26},
    {"id": "render-token",      "symbol": "RNDR",   "name": "Render",            "rank": 27},
    {"id": "shiba-inu",         "symbol": "SHIB",   "name": "Shiba Inu",         "rank": 28},
    {"id": "sui",               "symbol": "SUI",    "name": "Sui",               "rank": 29},
    {"id": "quant-network",     "symbol": "QNT",    "name": "Quant",             "rank": 30},
    # Fallbacks used if any above fail Yahoo Finance verification
    {"id": "the-graph",         "symbol": "GRT",    "name": "The Graph",         "rank": 31},
    {"id": "vechain",           "symbol": "VET",    "name": "VeChain",           "rank": 32},
    {"id": "theta-token",       "symbol": "THETA",  "name": "Theta Network",     "rank": 33},
    {"id": "eos",               "symbol": "EOS",    "name": "EOS",               "rank": 34},
    {"id": "tezos",             "symbol": "XTZ",    "name": "Tezos",             "rank": 35},
    {"id": "neo",               "symbol": "NEO",    "name": "NEO",               "rank": 36},
    {"id": "zcash",             "symbol": "ZEC",    "name": "Zcash",             "rank": 37},
    {"id": "dash",              "symbol": "DASH",   "name": "Dash",              "rank": 38},
    {"id": "iota",              "symbol": "IOTA",   "name": "IOTA",              "rank": 39},
    {"id": "decentraland",      "symbol": "MANA",   "name": "Decentraland",      "rank": 40},
]

_registry: list[dict] = []


def _build_coin(base: dict, live: dict | None = None) -> dict:
    sym = base["symbol"].upper()
    return {
        "id": base["id"],
        "symbol": sym,
        "name": base["name"],
        "binance_symbol": sym + "USDT",
        "market_cap_rank": base["rank"],
        "news_keywords": [sym.lower(), base["name"].lower().split()[0]],
        "current_price": live.get("current_price") if live else None,
        "price_change_24h": live.get("price_change_percentage_24h") if live else None,
    }


async def _yahoo_has_price(binance_symbol: str) -> bool:
    """Return True if Yahoo Finance returns a valid price for this symbol."""
    try:
        from utils import yahoo_history
        series = await yahoo_history.get_close_series(binance_symbol, days=2)
        return series is not None and len(series) > 0 and float(series.iloc[-1]) > 0
    except Exception:
        return False


async def fetch_and_build_registry(limit: int = 30) -> list[dict]:
    global _registry
    verified: list[dict] = []
    for c in CANDIDATE_COINS:
        if len(verified) >= limit:
            break
        if await _yahoo_has_price(c["symbol"] + "USDT"):
            verified.append(c)
            print(f"[coins] ✓ {c['symbol']}")
        else:
            print(f"[coins] ✗ {c['symbol']} — no Yahoo data, skipping")

    _registry = [_build_coin(c) for c in verified]
    print(f"[coins] Registry ready: {[c['symbol'] for c in _registry]}")
    return _registry


def get_registry() -> list[dict]:
    return _registry


def get_by_binance(symbol: str) -> dict | None:
    return next((c for c in _registry if c["binance_symbol"] == symbol), None)


def get_symbols() -> list[str]:
    return [c["binance_symbol"] for c in _registry]
