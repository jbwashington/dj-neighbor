# 🎧 dj-neighbor

A "now playing" website for the DJ next door. A device near your window listens
through its microphone, identifies the track with a Shazam-like API, and the
public page shows the song with one-tap links to **Spotify**, **Apple Music**,
and **YouTube Music**.

## How it works

```
window mic ──▶ /listen (browser, MediaRecorder)
                   │  POST 12s audio clip
                   ▼
              /api/recognize ──▶ AudD API ──▶ store "now playing"
                                                   │
public visitor ──▶ /  (polls /api/now-playing every 10s) ◀──┘
```

- **`/`** — public page. Polls now-playing and renders the song + streaming links.
- **`/listen`** — open this on the device by the window (your phone works great).
  Grants mic access, samples audio on an interval, pushes results.
- **`/api/recognize`** — forwards the clip to AudD, builds links, saves the song.
- **`/api/now-playing`** — returns the current song as JSON.

## Setup

1. Install deps:
   ```bash
   npm install
   ```
2. Copy env and fill it in:
   ```bash
   cp .env.example .env.local
   ```
   - `AUDD_API_TOKEN` — **required.** Free trial at https://dashboard.audd.io/
   - `LISTENER_SECRET` — recommended once deployed, so only your device can push.
   - `UPSTASH_REDIS_REST_URL` / `_TOKEN` — recommended on Vercel so the current
     song survives between serverless invocations (free DB at https://upstash.com).
3. Run locally:
   ```bash
   npm run dev
   ```
   Open http://localhost:3000 (public) and http://localhost:3000/listen (mic device).

> Mic capture needs a secure context: `localhost` works, and any HTTPS URL
> (like your Vercel deployment) works. Plain-HTTP LAN addresses will not.

## Deploy to Vercel

```bash
npm i -g vercel   # if you don't have it
vercel            # first deploy
vercel --prod     # production
```

Set the env vars in the Vercel project settings (Settings → Environment
Variables), then redeploy. Open `https://<your-app>.vercel.app/listen` on the
phone by the window and tap **Start listening**.

## Notes / tuning

- **Cost:** each check is one AudD recognition call. The default is one every
  30s. Raise the interval on `/listen` to spend less.
- **YouTube Music** has no public track-ID API, so that button is a search link
  for `artist + title`. Spotify and Apple Music links are exact.
- **Accuracy** depends on how cleanly the mic hears the music — closer to the
  window and lower background noise help a lot.
- The DJ's own mixes/mashups won't resolve to a catalog track; only commercially
  released songs will match.
