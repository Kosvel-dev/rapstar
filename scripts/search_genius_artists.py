#!/usr/bin/env python3
"""Search Genius for artist IDs (one-off helper)."""

from __future__ import annotations

import json
import os
import sys
import urllib.parse
import urllib.request

from dotenv import load_dotenv

QUERIES = [
    "LEX",
    "¥ellow Bucks",
    "Yellow Bucks",
    "BAD HOP",
    "VERRY SMoL",
    "Verry Smol",
    "sh1t rapper",
    "Sonsi rapper",
    "Kohjiya",
    "kZm",
    "Jin Dogg",
]


def search(token: str, q: str) -> list[dict]:
    url = "https://api.genius.com/search?" + urllib.parse.urlencode({"q": q})
    req = urllib.request.Request(
        url,
        headers={"Authorization": f"Bearer {token}"},
    )
    with urllib.request.urlopen(req, timeout=20) as res:
        data = json.loads(res.read().decode())
    hits = data.get("response", {}).get("hits", [])
    results = []
    for hit in hits[:8]:
        r = hit.get("result", {})
        primary = r.get("primary_artist") or {}
        if primary.get("name"):
            results.append(
                {
                    "query": q,
                    "artist_id": primary.get("id"),
                    "artist_name": primary.get("name"),
                    "artist_url": primary.get("url"),
                    "song_title": r.get("title"),
                }
            )
    return results


def main() -> int:
    load_dotenv()
    token = os.environ.get("GENIUS_ACCESS_TOKEN")
    if not token:
        print("GENIUS_ACCESS_TOKEN missing", file=sys.stderr)
        return 1

    seen: set[int] = set()
    for q in QUERIES:
        print(f"\n=== {q} ===")
        try:
            for row in search(token, q):
                aid = row["artist_id"]
                if aid in seen:
                    continue
                seen.add(aid)
                print(
                    f"  id={aid}  {row['artist_name']}  ({row['song_title']})"
                )
        except Exception as e:
            print(f"  error: {e}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
