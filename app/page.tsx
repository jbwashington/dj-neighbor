"use client";

import { useEffect, useState } from "react";
import type { NowPlaying } from "@/lib/types";

function timeAgo(ms: number): string {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return `${h}h ago`;
}

export default function Home() {
  const [song, setSong] = useState<NowPlaying | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    async function poll() {
      try {
        const res = await fetch("/api/now-playing", { cache: "no-store" });
        const data = (await res.json()) as { nowPlaying: NowPlaying | null };
        if (alive) {
          setSong(data.nowPlaying);
          setLoaded(true);
        }
      } catch {
        if (alive) setLoaded(true);
      }
    }
    poll();
    const id = setInterval(poll, 10_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return (
    <main className="wrap">
      <div className="kicker">
        <span className="live-dot" />
        Now playing outside
      </div>

      {!loaded ? (
        <div className="empty">Tuning in…</div>
      ) : !song ? (
        <div className="card">
          <div className="art">🎧</div>
          <div>
            <div className="title">Nothing yet</div>
            <p className="empty" style={{ marginTop: 8 }}>
              The DJ next door is quiet, or the listener isn&apos;t running.
            </p>
          </div>
        </div>
      ) : (
        <div className="card">
          {song.artwork ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="art" src={song.artwork} alt={song.album ?? song.title} />
          ) : (
            <div className="art">🎵</div>
          )}

          <div>
            <div className="title">{song.title}</div>
            <div className="artist">{song.artist}</div>
            {song.album ? <div className="album">{song.album}</div> : null}
          </div>

          <div className="links">
            {song.links.spotify ? (
              <a className="link-btn" href={song.links.spotify} target="_blank" rel="noreferrer">
                <span className="swatch spotify" /> Open in Spotify
              </a>
            ) : null}
            {song.links.appleMusic ? (
              <a className="link-btn" href={song.links.appleMusic} target="_blank" rel="noreferrer">
                <span className="swatch apple" /> Open in Apple Music
              </a>
            ) : null}
            <a className="link-btn" href={song.links.youtubeMusic} target="_blank" rel="noreferrer">
              <span className="swatch ytm" /> Open in YouTube Music
            </a>
          </div>

          <div className="meta">heard {timeAgo(song.recognizedAt)}</div>
        </div>
      )}
    </main>
  );
}
