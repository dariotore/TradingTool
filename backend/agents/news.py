import feedparser
import asyncio
from data import coins as coin_registry

FEEDS = [
    "https://cointelegraph.com/rss",
    "https://coindesk.com/arc/outboundfeeds/rss/",
    "https://decrypt.co/feed",
]

POSITIVE_WORDS = {"bullish", "surge", "rally", "gain", "adoption", "record", "high", "growth", "buy", "breakout", "upgrade", "partnership", "launch", "milestone"}
NEGATIVE_WORDS = {"bearish", "crash", "drop", "fall", "hack", "ban", "regulation", "sell", "fear", "loss", "lawsuit", "fine", "fraud", "warning", "dump"}


async def run(symbol: str) -> dict:
    coin = coin_registry.get_by_binance(symbol)
    keywords = coin["news_keywords"] if coin else [symbol.lower().replace("usdt", "")]
    try:
        articles = await asyncio.get_event_loop().run_in_executor(None, _fetch_news, keywords)
        score = _sentiment_score(articles)
        return {
            "agent": "news",
            "symbol": symbol,
            "score": score,
            "details": {
                "articles_found": len(articles),
                "articles": [{"title": a["title"], "url": a.get("url", ""), "summary": a.get("summary", "")} for a in articles[:5]],
                "sentiment_breakdown": _breakdown(articles),
            },
            "signal": _signal(score),
            "error": None,
        }
    except Exception as e:
        return {"agent": "news", "symbol": symbol, "score": 0, "details": {"articles_found": 0, "articles": []}, "signal": "NEUTRAL", "error": str(e)}


def _fetch_news(keywords: list) -> list:
    results = []
    for url in FEEDS:
        try:
            feed = feedparser.parse(url)
            for entry in feed.entries[:20]:
                title = entry.get("title", "").lower()
                summary = entry.get("summary", "").lower()
                text = title + " " + summary
                if any(k in text for k in keywords):
                    results.append({
                        "title": entry.get("title", ""),
                        "url": entry.get("link", ""),
                        "summary": entry.get("summary", "")[:300],
                        "text": text,
                    })
        except Exception:
            continue
    return results[:20]


def _sentiment_score(articles: list) -> float:
    if not articles:
        return 0.0
    total = sum(
        (sum(1 for w in POSITIVE_WORDS if w in a["text"]) - sum(1 for w in NEGATIVE_WORDS if w in a["text"]))
        / max(sum(1 for w in POSITIVE_WORDS | NEGATIVE_WORDS if w in a["text"]), 1)
        for a in articles
    )
    return round(total / len(articles), 3)


def _breakdown(articles: list) -> dict:
    pos = neg = neu = 0
    for a in articles:
        p = sum(1 for w in POSITIVE_WORDS if w in a["text"])
        n = sum(1 for w in NEGATIVE_WORDS if w in a["text"])
        if p > n:
            pos += 1
        elif n > p:
            neg += 1
        else:
            neu += 1
    return {"positive": pos, "negative": neg, "neutral": neu}


def _signal(score: float) -> str:
    if score > 0.2:
        return "BUY"
    if score < -0.2:
        return "SELL"
    return "NEUTRAL"
