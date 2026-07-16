#!/usr/bin/env python3
"""Fetch album cover art + dominant color for a curated music entry.

Usage:
    python scripts/music/fetch-cover.py "<search term>" [--slug <slug>] [--pick N]

Searches the iTunes Search API (no key needed), downloads the top match's
artwork at 512px into static/music/<slug>.jpg, extracts the dominant color,
and prints a frontmatter block to paste into src/content/music/<slug>.md.

The curation stays human: this script only resolves art/metadata for an album
Enoch already picked. It never chooses albums.
"""

import argparse
import io
import json
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "static" / "music"


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def search(term: str, limit: int = 5) -> list[dict]:
    url = "https://itunes.apple.com/search?" + urllib.parse.urlencode(
        {"term": term, "entity": "album", "limit": limit}
    )
    with urllib.request.urlopen(url, timeout=15) as res:
        return json.load(res)["results"]


def dominant_color(img: Image.Image) -> str:
    """Most frequent color after quantization — the placeholder shown while
    the texture streams in, so it should read as 'this album' at a glance."""
    small = img.convert("RGB").resize((100, 100))
    quantized = small.quantize(colors=8)
    counts = sorted(quantized.getcolors(), reverse=True)
    palette = quantized.getpalette()
    idx = counts[0][1]
    r, g, b = palette[idx * 3 : idx * 3 + 3]
    return f"#{r:02x}{g:02x}{b:02x}"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("term", help='search term, e.g. "muse absolution"')
    parser.add_argument("--slug", help="output filename (defaults from title)")
    parser.add_argument("--pick", type=int, default=0, help="result index")
    parser.add_argument(
        "--size",
        type=int,
        default=1200,
        help="artwork edge px (iTunes serves up to 3000)",
    )
    args = parser.parse_args()

    results = search(args.term)
    if not results:
        sys.exit(f"no album results for {args.term!r}")

    for i, r in enumerate(results):
        marker = "→" if i == args.pick else " "
        print(f"{marker} [{i}] {r['collectionName']} — {r['artistName']} ({r['releaseDate'][:4]})")

    album = results[args.pick]
    slug = args.slug or slugify(album["collectionName"])
    art_url = album["artworkUrl100"].replace(
        "100x100bb", f"{args.size}x{args.size}bb"
    )

    with urllib.request.urlopen(art_url, timeout=30) as res:
        raw = res.read()
    img = Image.open(io.BytesIO(raw))

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out = OUT_DIR / f"{slug}.jpg"
    img.convert("RGB").save(out, "JPEG", quality=85)
    color = dominant_color(img)

    print(f"\nsaved {out.relative_to(ROOT)} ({img.size[0]}x{img.size[1]}, {out.stat().st_size // 1024}KB)")
    print(f"\n--- src/content/music/{slug}.md ---")
    print("---")
    print("kind: album")
    print(f"title: {album['collectionName'].lower()}")
    print(f"artist: {album['artistName'].lower()}")
    print(f"year: {album['releaseDate'][:4]}")
    print(f"cover: /music/{slug}.jpg")
    print(f"color: \"{color}\"")
    print("---")


if __name__ == "__main__":
    main()
