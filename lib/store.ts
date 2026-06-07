import type { NowPlaying } from "./types";

const KEY = "dj-neighbor:now-playing";

const restUrl = process.env.UPSTASH_REDIS_REST_URL;
const restToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const useRedis = Boolean(restUrl && restToken);

// In-memory fallback. Survives within a single running process (good for local
// dev and a single long-lived server) but NOT across serverless invocations —
// configure Upstash for production on Vercel.
const globalForStore = globalThis as unknown as { __nowPlaying?: NowPlaying | null };

async function redisCommand(args: (string | number)[]): Promise<unknown> {
  const res = await fetch(`${restUrl}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${restToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Upstash error ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as { result: unknown };
  return data.result;
}

export async function getNowPlaying(): Promise<NowPlaying | null> {
  if (useRedis) {
    const raw = (await redisCommand(["GET", KEY])) as string | null;
    return raw ? (JSON.parse(raw) as NowPlaying) : null;
  }
  return globalForStore.__nowPlaying ?? null;
}

export async function setNowPlaying(value: NowPlaying): Promise<void> {
  if (useRedis) {
    await redisCommand(["SET", KEY, JSON.stringify(value)]);
    return;
  }
  globalForStore.__nowPlaying = value;
}
