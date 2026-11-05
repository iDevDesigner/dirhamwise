"use client";

import { useLiveRate, timeAgo } from "@/lib/live-rate";
import { useUI } from "@/lib/store";
import { currencySymbol } from "@/lib/format";
import { RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

/** Inline SVG sparkline for the last N daily closes. */
export function RateSpark({
  points,
  width = 120,
  height = 34,
  stroke = "#ffffff",
  className,
}: {
  points: { rate: number }[];
  width?: number;
  height?: number;
  stroke?: string;
  className?: string;
}) {
  if (points.length < 2) return null;
  const rates = points.map((p) => p.rate);
  const min = Math.min(...rates);
  const max = Math.max(...rates);
  const span = max - min || 1;
  const pad = 3;
  const step = (width - pad * 2) / (rates.length - 1);
  const y = (r: number) => pad + (1 - (r - min) / span) * (height - pad * 2);
  const d = rates.map((r, i) => `${i === 0 ? "M" : "L"}${(pad + i * step).toFixed(1)},${y(r).toFixed(1)}`).join(" ");
  return (
    <svg width={width} height={height} className={className} aria-hidden="true">
      <path d={`${d} L${width - pad},${height} L${pad},${height} Z`} fill={stroke} opacity={0.12} stroke="none" />
      <path d={d} fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Home-screen live AED→INR card. Tap opens the Home transfers view,
 * where the live rate can be applied to remittance entries.
 */
export function LiveRateCard() {
  const { data, error, refresh } = useLiveRate();
  const setView = useUI((s) => s.setView);

  const rate = data?.rate ?? null;
  const up = (data?.changePct ?? 0) >= 0;
  const spark = (data?.history ?? []).slice(0, 14).reverse();

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => setView("remittance")}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") setView("remittance");
      }}
      className="w-full press cursor-pointer text-left"
      aria-label="Live AED to INR rate — open home transfers"
    >
      <div className="hero-grad rounded-3xl p-4 text-white shadow-lg shadow-emerald-900/20 relative overflow-hidden">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-widest text-white/70">
            Live · AED → INR
          </span>
          <span className="ml-auto flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className={cn("absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping", error ? "bg-amber-300" : "bg-emerald-300")} />
              <span className={cn("relative inline-flex rounded-full h-2 w-2", error ? "bg-amber-300" : "bg-emerald-300")} />
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                void refresh();
              }}
              aria-label="Refresh rate"
              className="press w-7 h-7 rounded-full bg-white/10 flex items-center justify-center"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </span>
        </div>

        {rate == null ? (
          <p className="text-lg font-bold mt-2 text-white/80">
            {error ? "Rate unavailable — tap to retry" : "Loading live rate…"}
          </p>
        ) : (
          <>
            <div className="flex items-end justify-between gap-2 mt-1.5">
              <div className="flex items-end gap-2">
                <p className="text-4xl font-extrabold tnum tracking-tight leading-none">
                  {rate.toFixed(2)}
                </p>
                <span className="text-white/75 text-sm font-bold mb-0.5">
                  {currencySymbol("INR")}
                </span>
              </div>
              <RateSpark points={spark} className="opacity-90 shrink-0" />
            </div>

            <div className="flex items-center justify-between mt-2.5">
              <div className="flex items-center gap-2">
                {data?.changePct != null && (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full",
                      up ? "bg-emerald-300/20 text-emerald-100" : "bg-rose-300/20 text-rose-100"
                    )}
                  >
                    {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {up ? "+" : ""}
                    {data.changePct.toFixed(2)}% today
                  </span>
                )}
                <span className="text-[11px] text-white/65 font-semibold tnum">
                  1,000 AED = ₹{Math.round(rate * 1000).toLocaleString("en-IN")}
                </span>
              </div>
              <span className="text-[10px] text-white/50 font-medium">
                {data ? `Updated ${timeAgo(data.updatedAt)}` : ""}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Compact inline line for Glance mode. */
export function GlanceRateLine() {
  const { data } = useLiveRate();
  if (!data) return null;
  return (
    <p className="text-white/70 text-sm font-bold">
      1 AED = ₹{data.rate.toFixed(2)}
      <span className="text-white/45 font-semibold"> · live rate</span>
    </p>
  );
}
