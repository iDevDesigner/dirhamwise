import { NextResponse } from "next/server";
import { getLiveRate } from "@/lib/server/rate";
import { prisma } from "@/lib/server/prisma";

export const dynamic = "force-dynamic";

/**
 * Live AED→INR from free public APIs (no API key):
 *  - primary: open.er-api.com (ExchangeRate-API open endpoint)
 *  - fallback: @fawazahmed0/currency-api via jsDelivr / pages.dev
 * Daily snapshots are stored in the database so the app can show a
 * sparkline + "change vs yesterday" even after cold starts.
 */
export async function GET() {
  try {
    const info = await getLiveRate();
    const history = await prisma.rateSnapshot.findMany({
      orderBy: { day: "desc" },
      take: 30,
      select: { day: true, rate: true },
    });
    return NextResponse.json(
      { ...info, history },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (err) {
    console.error("rate route failed", err);
    return NextResponse.json({ error: "Rate service unavailable." }, { status: 502 });
  }
}
