import { NextResponse, type NextRequest } from "next/server";
import { getMarketStats } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// REWIRED to sonotrade: ticker === spotify_id.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  if (!ticker || ticker.length > 64 || !/^[A-Za-z0-9._-]+$/.test(ticker)) {
    return NextResponse.json({ error: "invalid_ticker" }, { status: 400 });
  }
  const stats = await getMarketStats(ticker);
  return NextResponse.json({ stats }, { headers: { 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30' } });
}
