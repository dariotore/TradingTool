import feedparser
import asyncio
from data.forex import get_by_id

FEEDS = [
    "https://www.forexlive.com/feed/news",
    "https://cointelegraph.com/rss",           # macro/financial news
    "https://coindesk.com/arc/outboundfeeds/rss/",
]

POSITIVE_WORDS = {"bullish", "surge", "rally", "gain", "strengthen", "hawkish", "rate hike", "growth", "recovery", "buy", "breakout", "upgrade", "positive"}
NEGATIVE_WORDS = {"bearish", "crash", "drop", "fall", "weaken", "dovish", "rate cut", "recession", "fear", "sell", "warning", "negative", "risk off", "slowdown"}


async def run(pair_id: str) -> dict:
    pair = get_by_id(pair_id)
    keywords = pair["keywords"] if pair else [pair_id.lower()]
    try:
        articles = await asyncio.get_event_loop().run_in_executor(None, _fetch, keywords)
        score = _sentiment(articles)
        return {
            "agent": "news",
            "symbol": pair_id,
            "score": score,
            "details": {
                "articles_found": len(articles),
                "articles": [{"title": a["title"], "url": a.get("url", ""), "summary": a.get("summary", "")} for a in articles[:5]],
                "sentiment_breakdown": _breakdown(articles),
            },
            "signal": _sig(score),
            "error": None,
        }
    except Exception as e:
        return {"agent": "news", "symbol": pair_id, "score": 0, "details": {"articles_found": 0, "articles": []}, "signal": "NEUTRAL", "error": str(e)}


def _fetch(keywords: list) -> list:
    results = []
    for url in FEEDS:
        try:
            feed = feedparser.parse(url)
            for entry in feed.entries[:25]:
                title = entry.get("title", "").lower()
                summary = entry.get("summary", "").lower()
                text = title + " " + summary
                if any(k in text for k in keywords):
                    results.append({"title": entry.get("title", ""), "url": entry.get("link", ""), "summary": entry.get("summary", "")[:300], "text": text})
        except Exception:
            continue
    return results[:20]


def _sentiment(articles: list) -> float:
    if not articles: return 0.0
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
        if p > n: pos += 1
        elif n > p: neg += 1
        else: neu += 1
    return {"positive": pos, "negative": neg, "neutral": neu}


def _sig(score: float) -> str:
    if score > 0.2:  return "BUY"
    if score < -0.2: return "SELL"
    return "NEUTRAL"
