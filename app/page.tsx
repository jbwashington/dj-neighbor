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

function clock(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function Home() {
  const [song, setSong] = useState<NowPlaying | null>(null);
  const [history, setHistory] = useState<NowPlaying[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    async function poll() {
      try {
        const [npRes, hRes] = await Promise.all([
          fetch("/api/now-playing", { cache: "no-store" }),
          fetch("/api/history", { cache: "no-store" }),
        ]);
        const np = (await npRes.json()) as { nowPlaying: NowPlaying | null };
        const h = (await hRes.json()) as { history: NowPlaying[] };
        if (alive) {
          setSong(np.nowPlaying);
          setHistory(h.history ?? []);
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

  // The newest history row is the current song; don't repeat it under the card.
  const past = song
    ? history.filter((h) => h.recognizedAt !== song.recognizedAt)
    : history;

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
            {[song.released, song.genre, song.label].filter(Boolean).length > 0 ? (
              <div className="album" style={{ opacity: 0.65, marginTop: 4 }}>
                {[song.released, song.genre, song.label].filter(Boolean).join(" · ")}
              </div>
            ) : null}
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

          <div className="meta">
            heard at {clock(song.recognizedAt)} · {timeAgo(song.recognizedAt)}
          </div>
        </div>
      )}

      {past.length > 0 ? (
        <section className="history">
          <div className="history-head">Recently played</div>
          <ul className="history-list">
            {past.map((h) => (
              <li className="history-row" key={`${h.recognizedAt}-${h.title}`}>
                {h.artwork ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="history-art" src={h.artwork} alt="" />
                ) : (
                  <div className="history-art history-art-empty">🎵</div>
                )}
                <div className="history-info">
                  <div className="history-title">{h.title}</div>
                  <div className="history-artist">{h.artist}</div>
                </div>
                <div className="history-side">
                  <div className="history-time">{clock(h.recognizedAt)}</div>
                  <div className="history-links">
                    {h.links.spotify ? (
                      <a href={h.links.spotify} target="_blank" rel="noreferrer" title="Spotify">
                        <span className="swatch spotify" />
                      </a>
                    ) : null}
                    {h.links.appleMusic ? (
                      <a href={h.links.appleMusic} target="_blank" rel="noreferrer" title="Apple Music">
                        <span className="swatch apple" />
                      </a>
                    ) : null}
                    <a href={h.links.youtubeMusic} target="_blank" rel="noreferrer" title="YouTube Music">
                      <span className="swatch ytm" />
                    </a>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
