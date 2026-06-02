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
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Download Genius lyrics for an artist and save JSON."
    )
    parser.add_argument(
        "--preset",
        choices=sorted(PRESETS),
        default="masato-hayashi",
        help="Built-in artist preset (default: masato-hayashi)",
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
        default="title",
        help="Song order from Genius (default: title)",
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


def main() -> int:
    load_dotenv()
    args = parse_args()

    preset = PRESETS[args.preset]
    artist_name = args.artist_name or str(preset["artist_name"])
    artist_id = args.artist_id or int(preset["artist_id"])
    output_dir = args.output_dir or Path(str(preset["output_dir"]))

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
    artist = fetch_artist(
        genius,
        artist_name,
        artist_id,
        max_songs=args.max_songs,
        include_features=not args.no_features,
        sort=args.sort,
    )

    outfile = export_json(artist, output_dir, artist_id)
    complete = sum(1 for song in artist.songs if song.lyrics)

    print()
    print(f"Artist: {artist.name}")
    print(f"Songs saved: {len(artist.songs)}")
    print(f"With lyrics: {complete}")
    print(f"Output: {outfile.resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
