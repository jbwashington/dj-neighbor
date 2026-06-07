import { NextResponse } from "next/server";
import { setNowPlaying } from "@/lib/store";
import type { NowPlaying, StreamingLinks } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Normalized result from whichever recognition backend we use. */
interface Recognized {
  title: string;
  artist: string;
  album?: string;
  released?: string;
  label?: string;
  genre?: string;
  artwork?: string;
  appleMusic?: string;
  spotify?: string;
}

function buildLinks(artist: string, title: string, r: Recognized): StreamingLinks {
  const q = encodeURIComponent(`${artist} ${title}`);
  return {
    spotify: r.spotify ?? `https://open.spotify.com/search/${q}`,
    appleMusic: r.appleMusic ?? `https://music.apple.com/us/search?term=${q}`,
    youtubeMusic: `https://music.youtube.com/search?q=${q}`,
  };
}

// ---- Backend: shazamio (free, unofficial Shazam) ----
async function recognizeShazamio(audio: Blob): Promise<Recognized | null> {
  const url = process.env.SHAZAMIO_URL ?? "http://127.0.0.1:3251/recognize";
  const form = new FormData();
  form.set("audio", audio, "clip.webm");
  const res = await fetch(url, { method: "POST", body: form, cache: "no-store" });
  if (!res.ok) throw new Error(`recognizer ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as Recognized & { matched: boolean };
  if (!data.matched || !data.title) return null;
  return data;
}

// ---- Backend: AudD (paid catalog, kept as a fallback) ----
interface AuddResult {
  artist?: string;
  title?: string;
  album?: string;
  label?: string;
  release_date?: string;
  apple_music?: { url?: string; artwork?: { url?: string }; genreNames?: string[] };
  spotify?: { external_urls?: { spotify?: string }; album?: { images?: { url?: string }[] } };
}
async function recognizeAudd(audio: Blob): Promise<Recognized | null> {
  const token = process.env.AUDD_API_TOKEN;
  if (!token) throw new Error("AUDD_API_TOKEN is not configured.");
  const form = new FormData();
  form.set("api_token", token);
  form.set("return", "apple_music,spotify");
  form.set("file", audio, "clip.webm");
  const res = await fetch("https://api.audd.io/", { method: "POST", body: form, cache: "no-store" });
  const json = (await res.json()) as { status: string; result: AuddResult | null; error?: { error_message: string } };
  if (json.status !== "success") throw new Error(json.error?.error_message ?? "AudD failed.");
  const r = json.result;
  if (!r) return null;
  const appleArt = r.apple_music?.artwork?.url?.replace("{w}", "500").replace("{h}", "500");
  return {
    title: r.title ?? "Unknown title",
    artist: r.artist ?? "Unknown artist",
    album: r.album,
    released: r.release_date?.slice(0, 4),
    label: r.label,
    genre: r.apple_music?.genreNames?.[0],
    artwork: r.spotify?.album?.images?.[0]?.url ?? appleArt,
    appleMusic: r.apple_music?.url,
    spotify: r.spotify?.external_urls?.spotify,
  };
}

export async function POST(request: Request) {
  // Optional shared-secret gate so only your listener device can push songs.
  const secret = process.env.LISTENER_SECRET;
  if (secret && request.headers.get("x-listener-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized listener." }, { status: 401 });
  }

  const incoming = await request.formData();
  const audio = incoming.get("audio");
  if (!(audio instanceof Blob)) {
    return NextResponse.json({ error: "No audio clip received." }, { status: 400 });
  }

  const backend = (process.env.RECOGNIZER ?? "shazamio").toLowerCase();
  let recognized: Recognized | null;
  try {
    recognized = backend === "audd"
      ? await recognizeAudd(audio)
      : await recognizeShazamio(audio);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Recognition failed.";
    console.log(`[recognize] backend=${backend} error: ${message}`);
    return NextResponse.json({ error: message }, { status: 502 });
  }

  if (!recognized) {
    // Heard something, but no match. Leave the last song in place.
    return NextResponse.json({ recognized: false });
  }

  const nowPlaying: NowPlaying = {
    title: recognized.title,
    artist: recognized.artist,
    album: recognized.album,
    released: recognized.released,
    label: recognized.label,
    genre: recognized.genre,
    artwork: recognized.artwork,
    links: buildLinks(recognized.artist, recognized.title, recognized),
    recognizedAt: Date.now(),
  };
  console.log(`[recognize] backend=${backend} matched: ${nowPlaying.artist} — ${nowPlaying.title}`);
  await setNowPlaying(nowPlaying);
  return NextResponse.json({ recognized: true, nowPlaying });
}
