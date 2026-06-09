import feedparser
import asyncio
import httpx
from data import coins as coin_registry

FEEDS = [
    "https://cointelegraph.com/rss",
    "https://coindesk.com/arc/outboundfeeds/rss/",
    "https://decrypt.co/feed",
]

# Reddit subreddits indexed per search
_REDDIT_BASE    = "https://www.reddit.com"
_REDDIT_HEADERS = {"User-Agent": "TradingPlatform/1.0 (research bot)"}
_REDDIT_SUBS    = ["CryptoCurrency", "Bitcoin", "ethereum", "altcoin"]

POSITIVE_WORDS = {
    "bullish", "surge", "rally", "gain", "adoption", "record", "high", "growth",
    "buy", "breakout", "upgrade", "partnership", "launch", "milestone", "soar",
    "recover", "rebound", "accumulate", "outperform", "all-time high", "ath",
    "institutional", "etf", "approval", "halving", "listing",
}
NEGATIVE_WORDS = {
    "bearish", "crash", "drop", "fall", "hack", "ban", "regulation", "sell",
    "fear", "loss", "lawsuit", "fine", "fraud", "warning", "dump", "plunge",
    "collapse", "liquidation", "exploit", "vulnerability", "scam", "rug",
    "delist", "investigation", "seized", "sanction",
}


async def run(symbol: str) -> dict:
    coin = coin_registry.get_by_binance(symbol)
    keywords = coin["news_keywords"] if coin else [symbol.lower().replace("usdt", "")]
    try:
        # Fetch RSS + Reddit in parallel
        rss_articles, reddit_articles = await asyncio.gather(
            asyncio.get_running_loop().run_in_executor(None, _fetch_news, keywords),
            _fetch_reddit(keywords, symbol),
            return_exceptions=True,
        )
        articles = []
        if not isinstance(rss_articles, Exception):
            articles.extend(rss_articles)
        if not isinstance(reddit_articles, Exception):
            articles.extend(reddit_articles)

        score    = _sentiment_score(articles)
        rss_cnt  = len(rss_articles) if not isinstance(rss_articles, Exception) else 0
        red_cnt  = len(reddit_articles) if not isinstance(reddit_articles, Exception) else 0

        return {
            "agent": "news",
            "symbol": symbol,
            "score": score,
            "details": {
                "articles_found": len(articles),
                "rss_count":      rss_cnt,
                "reddit_count":   red_cnt,
                "articles": [
                    {"title": a["title"], "url": a.get("url", ""), "source": a.get("source", "rss")}
                    for a in articles[:5]
                ],
                "sentiment_breakdown": _breakdown(articles),
            },
            "signal": _signal(score),
            "error": None,
        }
    except Exception as e:
        return {
            "agent": "news", "symbol": symbol, "score": 0,
            "details": {"articles_found": 0, "articles": []},
            "signal": "NEUTRAL", "error": str(e),
        }


# ── RSS fetch (sync, run in executor) ────────────────────────────────────────

def _fetch_news(keywords: list) -> list:
    results = []
    for url in FEEDS:
        try:
            feed = feedparser.parse(url)
            for entry in feed.entries[:20]:
                title   = entry.get("title", "").lower()
                summary = entry.get("summary", "").lower()
                text    = title + " " + summary
                if any(k in text for k in keywords):
                    results.append({
                        "title":   entry.get("title", ""),
                        "url":     entry.get("link", ""),
                        "text":    text,
                        "source":  "rss",
                    })
        except Exception:
            continue
    return results[:20]


# ── Reddit fetch (async, no auth needed via JSON API) ────────────────────────

async def _fetch_reddit(keywords: list, symbol: str) -> list:
    """
    Search recent Reddit posts for the coin keywords.
    Reddit's public JSON API works without OAuth — just needs a User-Agent.
    """
    # Use the primary keyword (usually the coin name / ticker)
    query = keywords[0] if keywords else symbol.lower().replace("usdt", "")
    results = []

    try:
        async with httpx.AsyncClient(timeout=10, headers=_REDDIT_HEADERS,
                                     follow_redirects=True) as client:
            r = await client.get(
                f"{_REDDIT_BASE}/r/CryptoCurrency/search.json",
                params={"q": query, "sort": "new", "limit": 15, "t": "day", "type": "link"},
            )
            if r.status_code == 200:
                for post in r.json().get("data", {}).get("children", []):
                    d     = post.get("data", {})
                    title = d.get("title", "").lower()
                    body  = d.get("selftext", "").lower()
                    text  = title + " " + body
                    if any(k in text for k in keywords):
                        results.append({
                            "title":  d.get("title", ""),
                            "url":    f"https://reddit.com{d.get('permalink', '')}",
                            "text":   text,
                            "source": "reddit",
                            "score":  d.get("score", 0),  # upvotes
                        })
    except Exception:
        pass

    return results[:10]


# ── Scoring ──────────────────────────────────────────────────────────────────

def _sentiment_score(articles: list) -> float:
    if not articles:
        return 0.0

    weighted_sum = 0.0
    weight_total = 0.0
    for a in articles:
        pos = sum(1 for w in POSITIVE_WORDS if w in a["text"])
        neg = sum(1 for w in NEGATIVE_WORDS if w in a["text"])
        tot = pos + neg
        if tot == 0:
            continue
        article_score = (pos - neg) / tot
        # Reddit posts with more upvotes carry more weight
        weight = 1 + min(a.get("score", 0) / 100, 2.0)
        weighted_sum  += article_score * weight
        weight_total  += weight

    if weight_total == 0:
        return 0.0
    return round(weighted_sum / weight_total, 3)


def _breakdown(articles: list) -> dict:
    pos = neg = neu = 0
    for a in articles:
        p = sum(1 for w in POSITIVE_WORDS if w in a["text"])
        n = sum(1 for w in NEGATIVE_WORDS if w in a["text"])
        if p > n:   pos += 1
        elif n > p: neg += 1
        else:       neu += 1
    return {"positive": pos, "negative": neg, "neutral": neu}


def _signal(score: float) -> str:
    if score > 0.2:  return "BUY"
    if score < -0.2: return "SELL"
    return "NEUTRAL"
