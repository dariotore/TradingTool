import asyncio
import httpx

COINGECKO_BASE = "https://api.coingecko.com/api/v3"
BINANCE_BASE = "https://api.binance.com/api/v3"

STABLECOIN_SYMBOLS = {
    "usdt", "usdc", "busd", "dai", "frax", "tusd", "usdp", "gusd",
    "lusd", "usdd", "fdusd", "pyusd", "eurs", "xaut", "paxg", "usdx",
    "usds", "usd0", "eurc", "rlusd", "susd", "usde", "usdx", "buidl",
    "steth", "wbtc", "weth", "weeth", "cbbtc", "btcb",  # wrapped
}

FALLBACK_COINS = [
    {"id": "bitcoin",        "symbol": "BTC",  "name": "Bitcoin",   "market_cap_rank": 1,  "news_keywords": ["bitcoin", "btc"]},
    {"id": "ethereum",       "symbol": "ETH",  "name": "Ethereum",  "market_cap_rank": 2,  "news_keywords": ["ethereum", "eth"]},
    {"id": "ripple",         "symbol": "XRP",  "name": "XRP",       "market_cap_rank": 3,  "news_keywords": ["xrp", "ripple"]},
    {"id": "binancecoin",    "symbol": "BNB",  "name": "BNB",       "market_cap_rank": 4,  "news_keywords": ["bnb", "binance"]},
    {"id": "solana",         "symbol": "SOL",  "name": "Solana",    "market_cap_rank": 5,  "news_keywords": ["solana", "sol"]},
    {"id": "dogecoin",       "symbol": "DOGE", "name": "Dogecoin",  "market_cap_rank": 6,  "news_keywords": ["dogecoin", "doge"]},
    {"id": "cardano",        "symbol": "ADA",  "name": "Cardano",   "market_cap_rank": 7,  "news_keywords": ["cardano", "ada"]},
    {"id": "tron",           "symbol": "TRX",  "name": "TRON",      "market_cap_rank": 8,  "news_keywords": ["tron", "trx"]},
    {"id": "avalanche-2",    "symbol": "AVAX", "name": "Avalanche", "market_cap_rank": 9,  "news_keywords": ["avalanche", "avax"]},
    {"id": "chainlink",      "symbol": "LINK", "name": "Chainlink", "market_cap_rank": 10, "news_keywords": ["chainlink", "link"]},
]

_registry: list[dict] = []


async def _get_binance_usdt_symbols() -> set[str]:
    """Fetch all active USDT pairs from Binance in one request."""
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(f"{BINANCE_BASE}/ticker/price")
        r.raise_for_status()
        return {item["symbol"] for item in r.json() if item["symbol"].endswith("USDT")}


def _build_coin(raw: dict) -> dict:
    sym = raw["symbol"].upper()
    return {
        "id": raw["id"],
        "symbol": sym,
        "name": raw["name"],
        "binance_symbol": sym + "USDT",
        "market_cap_rank": raw.get("market_cap_rank"),
        "news_keywords": raw.get("news_keywords") or [raw["symbol"].lower(), raw["name"].lower().split()[0]],
        "current_price": raw.get("current_price"),
        "price_change_24h": raw.get("price_change_percentage_24h") or raw.get("price_change_24h"),
    }


async def fetch_and_build_registry(limit: int = 10) -> list[dict]:
    global _registry
    try:
        # Fetch CoinGecko top-70 and Binance valid pairs in parallel
        cg_task = _fetch_coingecko(per_page=120)
        bn_task = _get_binance_usdt_symbols()
        coins, binance_symbols = await asyncio.gather(cg_task, bn_task, return_exceptions=True)

        if isinstance(coins, Exception):
            raise coins

        # If Binance lookup failed, accept all coins (errors handled later per-agent)
        valid_binance = binance_symbols if not isinstance(binance_symbols, Exception) else None

        result = []
        for c in coins:
            sym_lower = c["symbol"].lower()
            if sym_lower in STABLECOIN_SYMBOLS:
                continue
            if not c["symbol"].isalpha() or len(c["symbol"]) > 8:
                continue
            binance_sym = c["symbol"].upper() + "USDT"
            if valid_binance is not None and binance_sym not in valid_binance:
                continue
            result.append(_build_coin({**c, "news_keywords": None}))
            if len(result) >= limit:
                break

        _registry = result
        print(f"[coins] Registry built: {[c['symbol'] for c in _registry]}")
        return result

    except Exception as e:
        print(f"[coins] CoinGecko fetch failed ({e}), using fallback list")
        _registry = [_build_coin(c) for c in FALLBACK_COINS[:limit]]
        return _registry


async def _fetch_coingecko(per_page: int = 55) -> list[dict]:
    async with httpx.AsyncClient(timeout=15, headers={"User-Agent": "TradingPlatform/1.0"}) as client:
        r = await client.get(f"{COINGECKO_BASE}/coins/markets", params={
            "vs_currency": "usd",
            "order": "market_cap_desc",
            "per_page": per_page,
            "page": 1,
            "sparkline": "false",
            "price_change_percentage": "24h,7d",
        })
        r.raise_for_status()
        return r.json()


def get_registry() -> list[dict]:
    return _registry


def get_by_binance(symbol: str) -> dict | None:
    return next((c for c in _registry if c["binance_symbol"] == symbol), None)


def get_symbols() -> list[str]:
    return [c["binance_symbol"] for c in _registry]
