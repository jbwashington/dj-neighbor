#!/usr/bin/env bash
# Record a short clip from the webcam mic and push it to the local dj-neighbor
# recognizer. Run this from a NORMAL terminal window (not tmux) the first time,
# so macOS shows the Microphone permission prompt — click Allow.
set -euo pipefail

DEVICE="${1:-0}"          # avfoundation audio index (0 = HD Pro Webcam C920)
SECONDS_LEN="${2:-12}"
PORT="${PORT:-3247}"
CLIP="/tmp/djn-clip.mp3"

# Listener secret: from env, else read it out of the (gitignored) .env.local.
SECRET="${LISTENER_SECRET:-}"
if [ -z "${SECRET}" ] && [ -f "$(dirname "$0")/../.env.local" ]; then
  SECRET=$(grep -E '^LISTENER_SECRET=' "$(dirname "$0")/../.env.local" | cut -d= -f2-)
fi

echo "🎙️  recording ${SECONDS_LEN}s from audio device :${DEVICE} ..."
ffmpeg -hide_banner -loglevel error -f avfoundation -i ":${DEVICE}" \
  -t "${SECONDS_LEN}" -ac 1 -ar 44100 -y "${CLIP}"

# sanity-check the level so we know the mic actually heard something
maxvol=$(ffmpeg -hide_banner -i "${CLIP}" -af volumedetect -f null /dev/null 2>&1 \
  | grep max_volume | sed 's/.*max_volume: //')
echo "   level: max_volume ${maxvol:-unknown}"

echo "🔎  sending to recognizer on :${PORT} ..."
curl -s -m 25 -X POST "http://localhost:${PORT}/api/recognize" \
  -H "x-listener-secret: ${SECRET}" \
  -F "audio=@${CLIP};type=audio/mpeg"
echo
