import { NextResponse } from "next/server";
import { getNowPlaying } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const nowPlaying = await getNowPlaying();
  return NextResponse.json(
    { nowPlaying },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
