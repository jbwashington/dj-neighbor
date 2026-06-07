"""
dj-neighbor recognizer — wraps shazamio (unofficial Shazam) behind a tiny HTTP
API that returns a normalized song shape. The Next.js /api/recognize route POSTs
an audio clip here; we transcode to WAV with ffmpeg and ask Shazam to identify it.

Free, uses Shazam's full catalog. Unofficial — if Shazam changes their endpoints
this may break; the Next route can fall back to AudD by flipping an env var.
"""

import os
import subprocess
import tempfile
from urllib.parse import parse_qs, urlencode, urlsplit

from fastapi import FastAPI, File, HTTPException, UploadFile
from shazamio import Shazam

app = FastAPI(title="dj-neighbor recognizer")
shazam = Shazam()


def deep_find(obj, needle: str):
    """Recursively collect every string in obj that contains needle."""
    out = []
    if isinstance(obj, dict):
        for v in obj.values():
            out += deep_find(v, needle)
    elif isinstance(obj, list):
        for v in obj:
            out += deep_find(v, needle)
    elif isinstance(obj, str) and needle in obj:
        out.append(obj)
    return out


def first(values):
    return values[0] if values else None


def apple_music_url(track):
    """Shazam often returns Apple Music as an Android intent:// deep link.
    Prefer a real https URL; otherwise convert the intent form, and strip
    Shazam's tracking params down to the track id."""
    candidates = deep_find(track, "music.apple.com")
    url = next((c for c in candidates if c.startswith("http")), None)
    if not url:
        for c in candidates:
            if c.startswith("intent://"):
                url = "https://" + c[len("intent://"):].split("#Intent", 1)[0]
                break
    if not url:
        return None
    parts = urlsplit(url)
    qs = parse_qs(parts.query)
    keep = urlencode({"i": qs["i"][0]}) if "i" in qs else ""
    return f"{parts.scheme}://{parts.netloc}{parts.path}" + (f"?{keep}" if keep else "")


@app.get("/health")
async def health():
    return {"ok": True}


@app.post("/recognize")
async def recognize(audio: UploadFile = File(...)):
    data = await audio.read()
    if not data:
        raise HTTPException(status_code=400, detail="empty audio")

    src = tempfile.NamedTemporaryFile(suffix=".clip", delete=False)
    src.write(data)
    src.close()
    wav = src.name + ".wav"

    try:
        # Normalize whatever the browser sent (webm/opus, mp4, …) to mono 16k WAV.
        subprocess.run(
            ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
             "-i", src.name, "-ac", "1", "-ar", "16000", wav],
            check=True,
        )
        result = await shazam.recognize(wav)
    except subprocess.CalledProcessError:
        raise HTTPException(status_code=400, detail="could not decode audio")
    finally:
        for p in (src.name, wav):
            try:
                os.remove(p)
            except OSError:
                pass

    track = (result or {}).get("track")
    if not track:
        return {"matched": False}

    images = track.get("images") or {}
    sections = track.get("sections") or []
    album = None
    for section in sections:
        for meta in section.get("metadata", []) or []:
            if str(meta.get("title", "")).lower() == "album":
                album = meta.get("text")
                break
        if album:
            break

    return {
        "matched": True,
        "title": track.get("title"),
        "artist": track.get("subtitle"),
        "album": album,
        "artwork": images.get("coverarthq") or images.get("coverart"),
        "appleMusic": apple_music_url(track),
        "spotify": first(deep_find(track, "open.spotify.com")),
    }
