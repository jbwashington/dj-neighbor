import { promises as fs } from "fs";
import path from "path";
import type { NowPlaying } from "./types";

// Durable, file-backed play history. Self-hosted single process, low write rate
// (only when the song changes), so plain read-modify-write JSON is plenty.
const FILE = process.env.HISTORY_FILE || path.join(process.cwd(), ".data", "history.json");
const MAX = 1000;

async function readAll(): Promise<NowPlaying[]> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8")) as NowPlaying[];
  } catch {
    return [];
  }
}

export async function getHistory(limit = 200): Promise<NowPlaying[]> {
  return (await readAll()).slice(0, limit);
}

export async function appendHistory(song: NowPlaying): Promise<void> {
  const arr = await readAll();
  const last = arr[0];
  // Skip if the same track is still playing (recognized every ~10s while on).
  // A later replay in the set is a different neighbour entry and IS recorded.
  if (last && last.title === song.title && last.artist === song.artist) return;

  arr.unshift(song);
  const trimmed = arr.slice(0, MAX);
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(trimmed), "utf8");
}
