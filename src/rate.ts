import "server-only";

import { prisma } from "@/lib/server/prisma";

export interface RateInfo {
  /** INR per 1 AED */
  rate: number;
  /** previous close (yesterday) if known */
  prevClose: number | null;
  changePct: number | null;
  source: string;
  /** ISO time of the upstream update */
  updatedAt: string;
}

const TTL_MS = 10 * 60 * 1000; // cache upstream answers for 10 minutes
let cache: { at: number; info: RateInfo } | null = null;

const dayStr = (d: Date) => d.toISOString().slice(0, 10);

async function fetchJson(url: string, timeoutMs = 8000): Promise<unknown | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, {
      signal: ctrl.signal,
      cache: "no-store",
      headers: { accept: "application/json" },
    });
    clearTimeout(t);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/** Primary: ExchangeRate-API open endpoint (free, no key). */
async function fromErApi(): Promise<{ rate: number; updatedAt: string } | null> {
  const j = (await fetchJson("https://open.er-api.com/v6/latest/AED")) as
    | { result?: string; rates?: Record<string, number>; time_last_update_utc?: string }
    | null;
  const inr = j?.rates?.INR;
  if (j?.result === "success" && typeof inr === "number" && inr > 10 && inr < 100) {
    return {
      rate: inr,
      updatedAt: j.time_last_update_utc ? new Date(j.time_last_update_utc).toISOString() : new Date().toISOString(),
    };
  }
  return null;
}

/** Fallback 1/2: fawazahmed0 free currency API (jsDelivr CDN + pages.dev mirror). */
async function fromFawaz(day?: string): Promise<{ rate: number; day: string } | null> {
  const date = day ?? dayStr(new Date());
  const urls = day
    ? [
        `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${date}/v1/currencies/aed.json`,
        `https://${date}.currency-api.pages.dev/v1/currencies/aed.json`,
      ]
    : [
        "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/aed.json",
        "https://latest.currency-api.pages.dev/v1/currencies/aed.json",
      ];
  for (const url of urls) {
    const j = (await fetchJson(url)) as { date?: string; aed?: Record<string, number> } | null;
    const inr = j?.aed?.inr;
    if (typeof inr === "number" && inr > 10 && inr < 100) return { rate: inr, day: j?.date ?? date };
  }
  return null;
}

async function saveSnapshot(day: string, rate: number, source: string) {
  try {
    await prisma.rateSnapshot.upsert({
      where: { day },
      create: { day, rate, source },
      update: { rate, source, fetchedAt: new Date() },
    });
  } catch (err) {
    console.error("snapshot save failed", err);
  }
}

/** Ensure the last ~14 days exist in RateSnapshot (best effort, once). */
async function ensureHistory(): Promise<void> {
  try {
    const count = await prisma.rateSnapshot.count();
    if (count >= 14) return;
    const days: string[] = [];
    for (let i = 1; i <= 14; i++) {
      days.push(dayStr(new Date(Date.now() - i * 86400000)));
    }
    const existing = await prisma.rateSnapshot.findMany({
      where: { day: { in: days } },
      select: { day: true },
    });
    const have = new Set(existing.map((e) => e.day));
    const missing = days.filter((d) => !have.has(d));
    const results = await Promise.allSettled(missing.map((d) => fromFawaz(d)));
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status === "fulfilled" && r.value) {
        await saveSnapshot(missing[i], r.value.rate, "currency-api");
      }
    }
  } catch (err) {
    console.error("history backfill failed", err);
  }
}

export async function getLiveRate(): Promise<RateInfo> {
  // 1) memory cache
  if (cache && Date.now() - cache.at < TTL_MS) return cache.info;

  // 2) upstream
  let fresh: RateInfo | null = null;
  const er = await fromErApi();
  if (er) {
    fresh = {
      rate: er.rate,
      prevClose: null,
      changePct: null,
      source: "exchangerate-api",
      updatedAt: er.updatedAt,
    };
  } else {
    const f = await fromFawaz();
    if (f) {
      fresh = {
        rate: f.rate,
        prevClose: null,
        changePct: null,
        source: "currency-api",
        updatedAt: new Date(`${f.day}T12:00:00Z`).toISOString(),
      };
    }
  }

  const today = dayStr(new Date());

  if (fresh) {
    await saveSnapshot(today, fresh.rate, fresh.source);
  }

  // 3) history for change% + sparkline (works even if upstream hiccuped)
  await ensureHistory();
  const snaps = await prisma.rateSnapshot.findMany({
    orderBy: { day: "desc" },
    take: 30,
  });

  let info: RateInfo;
  if (snaps.length > 0) {
    const latest = snaps[0];
    const prev = snaps.find((s) => s.day < latest.day) ?? null;
    info = {
      rate: latest.rate,
      prevClose: prev?.rate ?? null,
      changePct:
        prev && prev.rate > 0 ? Math.round(((latest.rate - prev.rate) / prev.rate) * 10000) / 100 : null,
      source: latest.source,
      updatedAt: latest.fetchedAt?.toISOString?.() ?? new Date().toISOString(),
    };
  } else if (fresh) {
    info = fresh;
  } else {
    // Last resort: static approximation so the UI never shows garbage.
    info = {
      rate: 24.4,
      prevClose: null,
      changePct: null,
      source: "offline-fallback",
      updatedAt: new Date().toISOString(),
    };
  }

  cache = { at: Date.now(), info };
  return info;
}
