# dj-neighbor — self-hosted on the Mac Mini

Runs as two managed services, mirroring the existing homelab tunnel pattern.

| Piece          | What                                   | Where |
|----------------|----------------------------------------|-------|
| App            | `next start -p 3247` (user LaunchAgent)| `~/Library/LaunchAgents/com.djneighbor.app.plist` |
| Tunnel         | `cloudflared` quick tunnel (root Daemon)| `/Library/LaunchDaemons/com.cloudflare.cloudflared.dj-neighbor.plist` |
| App env        | token + listener secret                | `.env.local` |
| App logs       |                                        | `~/Library/Logs/com.djneighbor.app.{out,err}.log` |
| Tunnel logs    | the public URL is printed here         | `/Library/Logs/com.cloudflare.cloudflared.dj-neighbor.err.log` |

Single long-lived process, so the in-memory store is fine — no Upstash needed.

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

## Tunnel daemon (needs sudo once)

```bash
sudo cp deploy/com.cloudflare.cloudflared.dj-neighbor.plist /Library/LaunchDaemons/
sudo chown root:wheel /Library/LaunchDaemons/com.cloudflare.cloudflared.dj-neighbor.plist
sudo launchctl bootstrap system /Library/LaunchDaemons/com.cloudflare.cloudflared.dj-neighbor.plist
```

### Get the current public URL (quick tunnels change on restart)

```bash
grep -Eo 'https://[a-z0-9-]+\.trycloudflare\.com' \
  /Library/Logs/com.cloudflare.cloudflared.dj-neighbor.err.log | tail -1
```

## Upgrade to a stable URL later

Replace the quick-tunnel daemon with a named tunnel (like your other services):

```bash
cloudflared tunnel create dj-neighbor
cloudflared tunnel route dns dj-neighbor djneighbor.<your-domain>
# write ~/.cloudflared/dj-neighbor.yml with an ingress rule -> http://localhost:3247
# then point the daemon's ProgramArguments at: tunnel --config <file> run dj-neighbor
```
