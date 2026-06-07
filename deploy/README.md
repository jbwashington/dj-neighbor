# dj-neighbor — self-hosted on the Mac Mini

Public URL: **https://dj.negroindustries.com** (Cloudflare named tunnel).

Runs as three managed services, mirroring the existing homelab tunnel pattern.

| Piece          | What                                   | Where |
|----------------|----------------------------------------|-------|
| App            | `next start -H 127.0.0.1 -p 3247` (user LaunchAgent)| `~/Library/LaunchAgents/com.djneighbor.app.plist` |
| Recognizer     | shazamio FastAPI on `127.0.0.1:3251` (user LaunchAgent)| `~/Library/LaunchAgents/com.djneighbor.recognizer.plist` |
| Tunnel         | `cloudflared` **named** tunnel `dj-neighbor` (root Daemon)| `/Library/LaunchDaemons/com.cloudflare.cloudflared.dj-neighbor.plist` |
| Tunnel config  | ingress `dj.negroindustries.com` → `127.0.0.1:3247` | `~/.cloudflared/dj-neighbor.yml` |
| App env        | listener secret, recognizer backend    | `.env.local` |
| Logs           |                                        | `~/Library/Logs/com.djneighbor.{app,recognizer}.{out,err}.log` |

Single long-lived process, so the in-memory now-playing store is fine — no Upstash
needed. Play history persists to `.data/history.json`.

The app **must** bind `127.0.0.1` (not `0.0.0.0`): binding all interfaces collides
with the Tailscale `serve` listener on the same port (`EADDRINUSE`).

## App service (already installed)

```bash
# status
launchctl list | grep djneighbor
# restart (e.g. after editing .env.local or rebuilding)
launchctl kickstart -k gui/$(id -u)/com.djneighbor.app
# stop / start
launchctl bootout    gui/$(id -u)/com.djneighbor.app
launchctl bootstrap  gui/$(id -u) ~/Library/LaunchAgents/com.djneighbor.app.plist
```

After changing source: `npm run build` then kickstart.

## Recognizer service

```bash
launchctl kickstart -k gui/$(id -u)/com.djneighbor.recognizer   # restart
curl -s http://127.0.0.1:3251/health                            # {"ok":true}
```

## Tunnel daemon (named tunnel, needs sudo to install)

```bash
sudo cp deploy/com.cloudflare.cloudflared.dj-neighbor.plist /Library/LaunchDaemons/
sudo chown root:wheel /Library/LaunchDaemons/com.cloudflare.cloudflared.dj-neighbor.plist
sudo launchctl bootstrap system /Library/LaunchDaemons/com.cloudflare.cloudflared.dj-neighbor.plist
```

The daemon runs `cloudflared --config ~/.cloudflared/dj-neighbor.yml tunnel run dj-neighbor`.

### How the named tunnel was set up

```bash
cloudflared tunnel create dj-neighbor          # -> tunnel id + ~/.cloudflared/<id>.json
# DNS: CNAME dj.negroindustries.com -> <id>.cfargotunnel.com (proxied).
# NB: the cloudflared cert isn't authorized for negroindustries.com, so the
# record was created via the Cloudflare API/dashboard, not `tunnel route dns`.
# ~/.cloudflared/dj-neighbor.yml: ingress dj.negroindustries.com -> http://127.0.0.1:3247
```

## Other access paths

- Tailscale (tailnet-only, HTTPS): `https://jamess-mac-mini.tail5b1923.ts.net:3247/`
- Local on the Mini: `http://localhost:3247/`
