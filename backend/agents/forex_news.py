import feedparser
import asyncio
from data.forex import get_by_id

# Forex-specific RSS feeds (no crypto sources)
FEEDS = [
    "https://www.forexlive.com/feed/news",            # real-time forex/macro
    "https://www.fxstreet.com/rss/news",               # comprehensive forex news
    "https://feeds.reuters.com/reuters/businessNews",  # macro/central bank
]

# Macro-focused sentiment keywords
POSITIVE_WORDS = {
    "bullish", "surge", "rally", "gain", "strengthen", "hawkish", "rate hike",
    "growth", "recovery", "beat", "above forecast", "strong", "tightening",
    "buy", "breakout", "upgrade", "positive", "safe haven", "demand", "risk on",
    "outperform", "rebound", "stabilize",
}
NEGATIVE_WORDS = {
    "bearish", "crash", "drop", "fall", "weaken", "dovish", "rate cut",
    "recession", "fear", "miss", "below forecast", "weak", "easing",
    "sell", "warning", "negative", "risk off", "slowdown", "contraction",
    "selloff", "slump", "deteriorate", "disappointing",
}


async def run(pair_id: str) -> dict:
    pair = get_by_id(pair_id)
    keywords = pair["keywords"] if pair else [pair_id.lower()]
    try:
        articles = await asyncio.get_running_loop().run_in_executor(None, _fetch, keywords)
        score = _sentiment(articles)
        return {
            "agent": "news",
            "symbol": pair_id,
            "score": score,
            "details": {
                "articles_found": len(articles),
                "articles": [
                    {"title": a["title"], "url": a.get("url", ""), "summary": a.get("summary", "")}
                    for a in articles[:5]
                ],
                "sentiment_breakdown": _breakdown(articles),
            },
            "signal": _sig(score),
            "error": None,
        }
    except Exception as e:
        return {
            "agent": "news", "symbol": pair_id, "score": 0,
            "details": {"articles_found": 0, "articles": []},
            "signal": "NEUTRAL", "error": str(e),
        }


def _fetch(keywords: list) -> list:
    results = []
    for url in FEEDS:
        try:
            feed = feedparser.parse(url)
            for entry in feed.entries[:30]:
                title   = entry.get("title", "").lower()
                summary = entry.get("summary", "").lower()
                text    = title + " " + summary
                if any(k in text for k in keywords):
                    results.append({
                        "title":   entry.get("title", ""),
                        "url":     entry.get("link", ""),
                        "summary": entry.get("summary", "")[:300],
                        "text":    text,
                    })
        except Exception:
            continue
    return results[:20]


def _sentiment(articles: list) -> float:
    if not articles:
        return 0.0
    total = sum(
        (sum(1 for w in POSITIVE_WORDS if w in a["text"]) -
         sum(1 for w in NEGATIVE_WORDS if w in a["text"]))
        / max(sum(1 for w in POSITIVE_WORDS | NEGATIVE_WORDS if w in a["text"]), 1)
        for a in articles
    )
    return round(total / len(articles), 3)


def _breakdown(articles: list) -> dict:
    pos = neg = neu = 0
    for a in articles:
        p = sum(1 for w in POSITIVE_WORDS if w in a["text"])
        n = sum(1 for w in NEGATIVE_WORDS if w in a["text"])
        if   p > n: pos += 1
        elif n > p: neg += 1
        else:       neu += 1
    return {"positive": pos, "negative": neg, "neutral": neu}


def _sig(score: float) -> str:
    if score > 0.2:  return "BUY"
    if score < -0.2: return "SELL"
    return "NEUTRAL"
