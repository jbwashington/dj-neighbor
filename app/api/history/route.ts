import { NextResponse } from "next/server";
import { getHistory } from "@/lib/history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const history = await getHistory(200);
  return NextResponse.json(
    { history },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
