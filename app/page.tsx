"use client";

import { useEffect, useMemo, useState } from "react";
import type { NowPlaying } from "@/lib/types";
import { SpotifyIcon, AppleMusicIcon, YouTubeMusicIcon } from "./icons";

// A song counts as "now playing" only if it was heard near the current moment.
// The listener re-recognizes every ~10s while a track plays, refreshing the
// now-playing timestamp, so a gap longer than this means the DJ went quiet.
const FRESH_MS = 2 * 60 * 1000;

function timeAgo(ms: number): string {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function hhmm(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function dayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(ms: number): string {
  const diff = Math.round((startOfDay(Date.now()) - startOfDay(ms)) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return new Date(ms).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

interface Day {
  key: string;
  ms: number;
  songs: NowPlaying[];
}

export default function Home() {
  const [song, setSong] = useState<NowPlaying | null>(null);
  const [history, setHistory] = useState<NowPlaying[]>([]);
  const [loaded, setLoaded] = useState(false);
  // Which day the pager is viewing. null = follow the most recent day.
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

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

  // The last song we know about: the live now-playing entry, or, if the store
  // was cleared (e.g. server restart), the newest history row.
  const latest = song ?? history[0] ?? null;
  const isLive = latest !== null && Date.now() - latest.recognizedAt < FRESH_MS;

  // Group the play history into days, newest first. History arrives newest-first,
  // so both the day list and each day's songs stay in descending order.
  const days = useMemo<Day[]>(() => {
    const map = new Map<string, NowPlaying[]>();
    for (const h of history) {
      const k = dayKey(h.recognizedAt);
      const bucket = map.get(k);
      if (bucket) bucket.push(h);
      else map.set(k, [h]);
    }
    return Array.from(map.entries()).map(([key, songs]) => ({
      key,
      songs,
      ms: songs[0].recognizedAt,
    }));
  }, [history]);

  // Resolve the viewed day. If the selected day scrolled off (data trimmed) fall
  // back to the most recent day.
  let dayIndex = selectedKey ? days.findIndex((d) => d.key === selectedKey) : 0;
  if (dayIndex < 0) dayIndex = 0;
  const day = days[dayIndex] ?? null;

  // On the most recent day, the header already shows the last song — list only
  // the *previous* songs of that day beneath it.
  let rows = day ? day.songs : [];
  if (
    day &&
    dayIndex === 0 &&
    latest &&
    rows[0] &&
    rows[0].title === latest.title &&
    rows[0].artist === latest.artist
  ) {
    rows = rows.slice(1);
  }

  const canNewer = dayIndex > 0;
  const canOlder = dayIndex < days.length - 1;

  return (
    <main className="wrap">
      <div className="kicker">
        {isLive ? <span className="live-dot" /> : null}
        {isLive ? "Now playing outside" : latest ? "Last played" : "DJ Neighbor"}
      </div>

      {!loaded ? (
        <div className="empty">Tuning in…</div>
      ) : !latest ? (
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
          {latest.artwork ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="art" src={latest.artwork} alt={latest.album ?? latest.title} />
          ) : (
            <div className="art">🎵</div>
          )}

          <div>
            <div className="title">{latest.title}</div>
            <div className="artist">{latest.artist}</div>
            {latest.album ? <div className="album">{latest.album}</div> : null}
            {[latest.released, latest.genre, latest.label].filter(Boolean).length > 0 ? (
              <div className="album" style={{ opacity: 0.65, marginTop: 4 }}>
                {[latest.released, latest.genre, latest.label].filter(Boolean).join(" · ")}
              </div>
            ) : null}
          </div>

          <div className="links">
            {latest.links.spotify ? (
              <a className="link-btn" href={latest.links.spotify} target="_blank" rel="noreferrer">
                <SpotifyIcon /> Open in Spotify
              </a>
            ) : null}
            {latest.links.appleMusic ? (
              <a className="link-btn" href={latest.links.appleMusic} target="_blank" rel="noreferrer">
                <AppleMusicIcon /> Open in Apple Music
              </a>
            ) : null}
            <a className="link-btn" href={latest.links.youtubeMusic} target="_blank" rel="noreferrer">
              <YouTubeMusicIcon /> Open in YouTube Music
            </a>
          </div>

          <div className="meta">
            {isLive ? "heard at" : "last heard at"} {hhmm(latest.recognizedAt)} ·{" "}
            {timeAgo(latest.recognizedAt)}
          </div>
        </div>
      )}

      {days.length > 0 ? (
        <section className="history">
          <div className="day-nav">
            <button
              className="day-nav-btn"
              onClick={() => canNewer && setSelectedKey(days[dayIndex - 1].key)}
              disabled={!canNewer}
              aria-label="Newer day"
            >
              ‹
            </button>
            <div className="day-label">
              {dayLabel(day!.ms)}
              <span className="day-count">{day!.songs.length} songs</span>
            </div>
            <button
              className="day-nav-btn"
              onClick={() => canOlder && setSelectedKey(days[dayIndex + 1].key)}
              disabled={!canOlder}
              aria-label="Older day"
            >
              ›
            </button>
          </div>

          {rows.length > 0 ? (
            <ul className="history-list">
              {rows.map((h) => (
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
                    <div className="history-time">{hhmm(h.recognizedAt)}</div>
                    <div className="history-links">
                      {h.links.spotify ? (
                        <a href={h.links.spotify} target="_blank" rel="noreferrer" title="Spotify">
                          <SpotifyIcon />
                        </a>
                      ) : null}
                      {h.links.appleMusic ? (
                        <a href={h.links.appleMusic} target="_blank" rel="noreferrer" title="Apple Music">
                          <AppleMusicIcon />
                        </a>
                      ) : null}
                      <a href={h.links.youtubeMusic} target="_blank" rel="noreferrer" title="YouTube Music">
                        <YouTubeMusicIcon />
                      </a>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="day-empty">No other songs {dayIndex === 0 ? "yet today" : "this day"}.</div>
          )}
        </section>
      ) : null}
    </main>
  );
}
