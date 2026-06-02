import json
from pathlib import Path

for slug in [
    "sh1t",
    "son-si",
    "verry-smol",
    "kohjiya",
    "lex",
    "yellow-bucks",
    "bad-hop",
]:
    p = Path("data") / slug / "lyrics.json"
    if p.exists():
        d = json.loads(p.read_text(encoding="utf-8"))
        a = d["artist"]
        print(
            f"{slug}: {a['name']} - "
            f"{a['lyrics_complete_count']}/{a['genius_song_count']} lyrics"
        )
    else:
        print(f"{slug}: pending")
