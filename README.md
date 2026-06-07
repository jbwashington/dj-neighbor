# 🎧 dj-neighbor

A "now playing" website for the DJ next door. A browser device near a window
listens through its microphone, identifies the track, and a public page shows
the song with one-tap links to **Spotify**, **Apple Music**, and **YouTube
Music**.

Recognition runs **free** through a local [shazamio](https://github.com/shazamio/ShazamIO)
service (unofficial Shazam). [AudD](https://audd.io) is supported as a paid
fallback via an env var.

## How it works

```
window mic ──▶ /listen (browser, MediaRecorder, raw audio)
                   │  POST short audio clip
                   ▼
              Next.js /api/recognize
                   │  forwards clip
                   ▼
        recognizer service (FastAPI + shazamio)   ── ffmpeg → wav → Shazam
                   │  { title, artist, artwork, links }
                   ▼
              stores "now playing"
                   ▲
public visitor ──▶ /  (polls /api/now-playing every 10s)
```

- **`/`** — public page. Polls now-playing and renders the song + streaming links. No link to the listener.
- **`/listen`** — open on the device by the window. Grants mic access, lets you pick the input device, samples audio on an interval, pushes results. Gated by a shared secret.
- **`/api/recognize`** — auth-gates, then calls the configured backend (shazamio or AudD).
- **`/api/now-playing`** — returns the current song as JSON.

## Components

| Part | Stack | Default address |
|------|-------|-----------------|
| Web app | Next.js 15 (App Router) | `127.0.0.1:3247` |
| Recognizer | Python · FastAPI · uvicorn · shazamio | `127.0.0.1:3251` |

## Local setup

```bash
# 1. Web app
npm install
cp .env.example .env.local     # set LISTENER_SECRET (and AUDD_API_TOKEN only if RECOGNIZER=audd)

# 2. Recognizer service (needs ffmpeg on PATH)
cd recognizer
python3 -m venv .venv
./.venv/bin/pip install -r requirements.txt
./.venv/bin/uvicorn app:app --host 127.0.0.1 --port 3251

# 3. Web app (in another shell)
npm run dev      # http://localhost:3000  (or `npm run build && npm start` for prod)
```

Open `/` (public) and `/listen` (mic device). Mic capture needs a secure
context: `localhost` works, and any HTTPS origin works.

### Environment (`.env.local`)

| Var | Purpose |
|-----|---------|
| `RECOGNIZER` | `shazamio` (free, default) or `audd` (paid) |
| `SHAZAMIO_URL` | recognizer endpoint, default `http://127.0.0.1:3251/recognize` |
| `LISTENER_SECRET` | shared secret; the `/listen` device sends it as `x-listener-secret` to push songs |
| `AUDD_API_TOKEN` | only needed when `RECOGNIZER=audd` |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | optional; persist now-playing across serverless invocations (not needed for a single long-lived process) |

## Self-hosting

This instance runs on an always-on Mac Mini as managed services. Full ops notes
— LaunchAgents for the app and recognizer, the Cloudflare quick-tunnel daemon,
and the Tailscale HTTPS proxy — live in [`deploy/README.md`](deploy/README.md).

Key gotchas baked into the code:

- **Bind the web app to `127.0.0.1`**, not `0.0.0.0`. Binding all interfaces
  collides with `tailscale serve --https=3247` (which listens on the tailnet IP)
  and fails with `EADDRINUSE`.
- **The `/listen` capture disables `echoCancellation` / `noiseSuppression` /
  `autoGainControl`.** Those voice-call filters treat music as noise and gut
  recognition. Raw capture is required.

## Notes

- **Latency:** ~6s clip + Shazam round-trip ≈ a few seconds of lag. Fast DJ cuts
  can outrun it; tune clip length / interval on `/listen`.
- **YouTube Music** has no public track-ID API, so that button is a search link.
  Spotify/Apple links use direct URLs when the backend provides them, otherwise
  a search link — so all three buttons always work.
- Only commercially released songs match; live mashups/edits won't resolve.
