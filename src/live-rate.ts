"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { db, getSettings, setSetting, DEFAULT_RATES } from "./db";

// ─── Live AED→INR feed (free public APIs via /api/rate) ──────────────────────

export interface RatePoint {
  day: string; // YYYY-MM-DD
  rate: number; // INR per 1 AED
}

export interface LiveRateData {
  rate: number;
  prevClose: number | null;
  changePct: number | null;
  source: string;
  updatedAt: string;
  history: RatePoint[];
}

const CACHE_KEY = "dw-rate-cache-v1";
const REFRESH_MS = 5 * 60 * 1000; // 5 minutes

interface RateState {
  data: LiveRateData | null;
  loading: boolean;
  error: string | null;
  lastFetch: number;
  fetchRate: (force?: boolean) => Promise<void>;
  refresh: () => Promise<void>;
}

let timerStarted = false;
let inflight: Promise<void> | null = null;

function readCache(): LiveRateData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as LiveRateData) : null;
  } catch {
    return null;
  }
}

function writeCache(data: LiveRateData) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

/**
 * Keeps settings.rates.INR aligned with the live AED→INR rate so every
 * conversion in the app (balances, budgets, CSV export…) uses fresh INR.
 */
async function applyInrToSettings(data: LiveRateData): Promise<void> {
  try {
    const s = await getSettings();
    if (!s.autoInr || s.baseCurrency !== "AED") return;
    const target = 1 / data.rate; // rates map: 1 INR = N AED
    const current = s.rates.INR ?? DEFAULT_RATES.INR;
    if (!current || Math.abs(current - target) / current > 0.0005) {
      await setSetting("rates", { ...s.rates, INR: Math.round(target * 1000000) / 1000000 });
    }
  } catch {
    /* non-fatal */
  }
}

export const useRateStore = create<RateState>((set, get) => ({
  data: null,
  loading: false,
  error: null,
  lastFetch: 0,

  fetchRate: async (force = false) => {
    const { data, lastFetch } = get();
    if (!force && data && Date.now() - lastFetch < REFRESH_MS) return;
    if (inflight) return inflight;

    if (typeof window === "undefined") return;
    if (!data) {
      const cached = readCache();
      if (cached) set({ data: cached });
    }

    inflight = (async () => {
      set({ loading: true, error: null });
      try {
        const res = await fetch("/api/rate", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as LiveRateData;
        writeCache(json);
        set({ data: json, loading: false, lastFetch: Date.now() });
        void applyInrToSettings(json);
      } catch (err) {
        set({
          loading: false,
          error: err instanceof Error ? err.message : "Could not load rate",
          lastFetch: Date.now(),
        });
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  },

  refresh: () => get().fetchRate(true),
}));

/** Subscribe + auto-refresh helper for components. */
export function useLiveRate(): {
  data: LiveRateData | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const data = useRateStore((s) => s.data);
  const loading = useRateStore((s) => s.loading);
  const error = useRateStore((s) => s.error);
  const fetchRate = useRateStore((s) => s.fetchRate);
  const refresh = useRateStore((s) => s.refresh);

  useEffect(() => {
    void fetchRate();
  }, [fetchRate]);

  return { data, loading, error, refresh };
}

function startAutoRefresh(fetchRate: (force?: boolean) => Promise<void>) {
  if (timerStarted || typeof window === "undefined") return;
  timerStarted = true;
  setInterval(() => void fetchRate(), REFRESH_MS);
  window.addEventListener("online", () => void fetchRate(true));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void fetchRate();
  });
}

// Kick off the shared timers on first client import.
if (typeof window !== "undefined") {
  startAutoRefresh(useRateStore.getState().fetchRate);
}

/** "2 min ago" style label from an ISO timestamp. */
export function timeAgo(iso: string | number): string {
  const ts = typeof iso === "number" ? iso : new Date(iso).getTime();
  const mins = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  return `${Math.round(hrs / 24)} d ago`;
}
