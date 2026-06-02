#!/usr/bin/env python3
"""Fetch an artist's lyrics from Genius and save as JSON."""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import UTC, datetime
from pathlib import Path

from dotenv import load_dotenv
from lyricsgenius import Genius

PRESETS: dict[str, dict[str, object]] = {
    # RAPSTAR 2025 ファイナリスト（既存）
    "masato-hayashi": {
        "artist_id": 2896246,
        "artist_name": "Masato Hayashi",
        "output_dir": Path("data/masato-hayashi"),
    },
    "pxrge-trxxxper": {
        "artist_id": 4197590,
        "artist_name": "Pxrge Trxxxper",
        "output_dir": Path("data/pxrge-trxxxper"),
    },
    # RAPSTAR 2025 ファイナリスト
    "sh1t": {
        "artist_id": 3803934,
        "artist_name": "sh1t",
        "output_dir": Path("data/sh1t"),
    },
    "son-si": {
        "artist_id": 4609257,
        "artist_name": "Sonsi",
        "output_dir": Path("data/son-si"),
    },
    "verry-smol": {
        "artist_id": 4600857,
        "artist_name": "VERRY SMoL",
        "output_dir": Path("data/verry-smol"),
    },
    # RAPSTAR 2024 優勝
    "kohjiya": {
        "artist_id": 2645135,
        "artist_name": "Kohjiya",
        "output_dir": Path("data/kohjiya"),
    },
    # 人気 / シーン代表
    "lex": {
        "artist_id": 2088436,
        "artist_name": "LEX (JPN)",
        "output_dir": Path("data/lex"),
    },
    "yellow-bucks": {
        "artist_id": 2239329,
        "artist_name": "¥ellow Bucks",
        "output_dir": Path("data/yellow-bucks"),
    },
    "bad-hop": {
        "artist_id": 611655,
        "artist_name": "BAD HOP",
        "output_dir": Path("data/bad-hop"),
    },
}

NEW_PRESET_SLUGS = [
    "sh1t",
    "son-si",
    "verry-smol",
    "kohjiya",
    "lex",
    "yellow-bucks",
    "bad-hop",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Download Genius lyrics for an artist and save JSON."
    )
    parser.add_argument(
        "--preset",
        choices=sorted(PRESETS),
        help="Built-in artist preset",
    )
    parser.add_argument(
        "--all-new",
        action="store_true",
        help="Fetch all presets listed in NEW_PRESET_SLUGS",
    )
    parser.add_argument("--artist-name", help="Override artist name")
    parser.add_argument("--artist-id", type=int, help="Override Genius artist ID")
    parser.add_argument(
        "--output-dir",
        type=Path,
        help="Directory for JSON output",
    )
    parser.add_argument(
        "--max-songs",
        type=int,
        default=None,
        help="Limit number of songs with lyrics (default: all)",
    )
    parser.add_argument(
        "--no-features",
        action="store_true",
        help="Exclude songs where the artist is only featured",
    )
    parser.add_argument(
        "--sort",
        choices=("title", "popularity"),
        default="popularity",
        help="Song order from Genius (default: popularity)",
    )
    return parser.parse_args()


def song_record(song: object) -> dict[str, object]:
    featured = [a["name"] for a in getattr(song, "featured_artists", [])]
    album = getattr(song, "album", None)
    return {
        "id": song._body["id"],
        "title": song.title,
        "full_title": song.full_title,
        "primary_artist": song.artist,
        "featured_artists": featured,
        "release_date": song._body.get("release_date_for_display"),
        "language": song._body.get("language"),
        "lyrics_state": song.lyrics_state,
        "annotation_count": song.annotation_count or 0,
        "url": song.url,
        "album": album["name"] if album else None,
        "lyrics": song.lyrics,
    }


def build_genius(token: str) -> Genius:
    return Genius(
        token,
        remove_section_headers=False,
        skip_non_songs=True,
        retries=3,
        timeout=20,
    )


def fetch_artist(
    genius: Genius,
    artist_name: str,
    artist_id: int,
    *,
    max_songs: int | None,
    include_features: bool,
    sort: str,
) -> object:
    artist = genius.search_artist(
        artist_name,
        artist_id=artist_id,
        max_songs=max_songs,
        sort=sort,
        per_page=50,
        get_full_info=True,
        allow_name_change=False,
        include_features=include_features,
    )
    if artist is None:
        raise RuntimeError(f"Artist not found: {artist_name} (id={artist_id})")
    return artist


def export_json(artist: object, output_dir: Path, artist_id: int) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)

    songs = [song_record(song) for song in artist.songs]
    with_lyrics = [s for s in songs if s["lyrics"]]
    without_lyrics = [s for s in songs if not s["lyrics"]]

    payload = {
        "fetched_at": datetime.now(UTC).isoformat(),
        "source": "genius.com",
        "artist": {
            "id": artist_id,
            "name": artist.name,
            "url": artist.url,
            "genius_song_count": len(songs),
            "lyrics_complete_count": len(with_lyrics),
            "lyrics_missing_count": len(without_lyrics),
        },
        "songs": songs,
    }

    outfile = output_dir / "lyrics.json"
    outfile.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    index = {
        "artist": payload["artist"],
        "fetched_at": payload["fetched_at"],
        "songs_with_lyrics": [
            {
                "id": s["id"],
                "title": s["title"],
                "release_date": s["release_date"],
                "url": s["url"],
            }
            for s in with_lyrics
        ],
        "songs_without_lyrics": [
            {
                "id": s["id"],
                "title": s["title"],
                "release_date": s["release_date"],
                "lyrics_state": s["lyrics_state"],
                "url": s["url"],
            }
            for s in without_lyrics
        ],
    }
    (output_dir / "index.json").write_text(
        json.dumps(index, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    songs_dir = output_dir / "songs"
    songs_dir.mkdir(exist_ok=True)
    for song in with_lyrics:
        song_path = songs_dir / f"{song['id']}.json"
        song_path.write_text(
            json.dumps(song, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

    return outfile


def run_fetch(
    genius: Genius,
    *,
    artist_name: str,
    artist_id: int,
    output_dir: Path,
    max_songs: int | None,
    include_features: bool,
    sort: str,
) -> int:
    artist = fetch_artist(
        genius,
        artist_name,
        artist_id,
        max_songs=max_songs,
        include_features=include_features,
        sort=sort,
    )
    outfile = export_json(artist, output_dir, artist_id)
    complete = sum(1 for song in artist.songs if song.lyrics)
    print()
    print(f"Artist: {artist.name}")
    print(f"Songs saved: {len(artist.songs)}")
    print(f"With lyrics: {complete}")
    print(f"Output: {outfile.resolve()}")
    return complete


def main() -> int:
    load_dotenv()
    args = parse_args()

    if not args.preset and not args.all_new:
        if not (args.artist_id and args.output_dir and args.artist_name):
            print(
                "Specify --preset, --all-new, or "
                "--artist-id + --artist-name + --output-dir",
                file=sys.stderr,
            )
            return 1

    token = os.environ.get("GENIUS_ACCESS_TOKEN")
    if not token:
        print(
            "GENIUS_ACCESS_TOKEN is not set.\n"
            "1. Create a client at https://genius.com/api-clients\n"
            "2. Copy .env.example to .env and paste your token",
            file=sys.stderr,
        )
        return 1

    genius = build_genius(token)
    slugs = NEW_PRESET_SLUGS if args.all_new else [args.preset]  # type: ignore[list-item]

    for slug in slugs:
        preset = PRESETS[slug]
        artist_name = args.artist_name or str(preset["artist_name"])
        artist_id = args.artist_id or int(preset["artist_id"])
        output_dir = args.output_dir or Path(str(preset["output_dir"]))

        if args.all_new or len(slugs) > 1:
            print(f"\n{'=' * 60}\nFetching preset: {slug}\n{'=' * 60}")

        try:
            run_fetch(
                genius,
                artist_name=artist_name,
                artist_id=artist_id,
                output_dir=output_dir,
                max_songs=args.max_songs,
                include_features=not args.no_features,
                sort=args.sort,
            )
        except Exception as exc:
            print(f"FAILED {slug}: {exc}", file=sys.stderr)
            if not args.all_new:
                return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
