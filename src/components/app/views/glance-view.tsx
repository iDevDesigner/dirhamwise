"use client";

import { useMemo } from "react";
import { useUI } from "@/lib/store";
import {
  budgetProgressFor,
  computeBalances,
  netWorthOf,
  useBudgets,
  useData,
  useMonthTotals,
  useUpcoming,
} from "@/lib/queries";
import { currencySymbol, dateLabel, monthKey, monthLabel, todayStr } from "@/lib/format";
import { healthScore } from "@/lib/insights";
import { ChevronLeft, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlanceRateLine } from "../widgets/rate-card";
import { format, parseISO } from "date-fns";

/** Big-type, glanceable summary — designed to be pinned to the home screen. */
export default function GlanceView() {
  const { data } = useData();
  const setView = useUI((s) => s.setView);
  const month = monthKey(new Date());
  const totals = useMonthTotals(month);
  const budgets = useBudgets();
  const upcoming = useUpcoming();

  const { net, balances } = useMemo(() => {
    if (!data) return { net: 0, balances: {} as ReturnType<typeof computeBalances> };
    const b = computeBalances(data.accounts, data.txns, data.settings);
    return { net: netWorthOf(data.accounts, b), balances: b };
  }, [data]);

  if (!data || !totals) return <div className="min-h-dvh hero-grad" />;
  const cur = data.settings.baseCurrency;
  const { overall } = budgetProgressFor(budgets ?? [], totals, data.categories);
  const today = todayStr();
  const todaySpend = totals.byDay[today]?.expense ?? 0;
  const nextBill = upcoming?.bills[0];
  const health = healthScore({
    totals,
    budgets: (budgets ?? []).map((b) => ({ categoryId: b.categoryId, amount: b.amount })),
    accounts: data.accounts.filter((a) => a.includeInNet && !a.archived).map((a) => ({ balanceBase: balances[a.id!]?.balanceBase ?? 0 })),
    goals: [],
    bills: upcoming?.bills ?? [],
    remittances: [],
    txns: data.txns,
    settings: data.settings,
  });

  const daysLeft = Math.max(
    1,
    new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate() + 1
  );

  return (
    <div className="min-h-dvh hero-grad text-white flex flex-col safe-top">
      <div className="flex items-center justify-between px-4 pt-3">
        <button onClick={() => setView("home", false)} className="press w-10 h-10 rounded-full bg-white/10 flex items-center justify-center" aria-label="Back to app">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <p className="text-xs font-bold uppercase tracking-widest text-white/70">Money Glance</p>
        <span className="w-10" />
      </div>

      <div className="flex-1 flex flex-col justify-center gap-6 px-6 py-8 max-w-lg w-full mx-auto">
        <div>
          <p className="text-white/70 text-sm font-bold uppercase tracking-wider">Net worth</p>
          <p className="text-6xl font-extrabold tnum tracking-tight leading-none mt-2">
            {net.toLocaleString("en-AE", { maximumFractionDigits: 0 })}
          </p>
          <p className="text-white/75 font-bold mt-1">{cur} · {format(new Date(), "d MMM yyyy")}</p>
          <div className="mt-2"><GlanceRateLine /></div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-white/60 text-[11px] font-bold uppercase tracking-wider">Spent today</p>
            <p className="text-3xl font-extrabold tnum mt-1">{todaySpend.toLocaleString("en-AE")}</p>
          </div>
          <div>
            <p className="text-white/60 text-[11px] font-bold uppercase tracking-wider">This month</p>
            <p className="text-3xl font-extrabold tnum mt-1">{totals.expense.toLocaleString("en-AE")}</p>
            <p className="text-white/60 text-[11px] font-semibold">{monthLabel(month)}</p>
          </div>
        </div>

        {overall && (
          <div>
            <div className="flex justify-between items-baseline">
              <p className="text-white/70 text-[11px] font-bold uppercase tracking-wider">Budget left</p>
              <p className="text-white/60 text-[11px] font-semibold">{overall.pct}% used</p>
            </div>
            <p className={cn("text-4xl font-extrabold tnum mt-1", overall.left < 0 && "text-red-200")}>
              {overall.left >= 0 ? overall.left.toLocaleString("en-AE") : `−${Math.abs(overall.left).toLocaleString("en-AE")}`}
            </p>
            <div className="h-2.5 rounded-full bg-white/20 overflow-hidden mt-2.5">
              <div
                className={cn("h-full rounded-full", overall.pct > 100 ? "bg-red-300" : overall.pct > 85 ? "bg-amber-300" : "bg-white")}
                style={{ width: `${Math.min(100, overall.pct)}%` }}
              />
            </div>
            {overall.left > 0 && (
              <p className="text-white/60 text-[11px] font-semibold mt-1.5">
                ≈ {Math.round(overall.left / daysLeft).toLocaleString("en-AE")} {cur}/day for the next {daysLeft} days
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-3xl bg-white/10 backdrop-blur p-4">
            <p className="text-white/60 text-[10px] font-bold uppercase tracking-wider">Money health</p>
            <p className="text-3xl font-extrabold tnum mt-1">{health.score}</p>
            <p className="text-white/70 text-xs font-bold">{health.band}</p>
          </div>
          <div className="rounded-3xl bg-white/10 backdrop-blur p-4">
            <p className="text-white/60 text-[10px] font-bold uppercase tracking-wider">Next bill</p>
            {nextBill ? (
              <>
                <p className="text-lg font-extrabold truncate mt-1">{nextBill.name}</p>
                <p className="text-white/70 text-xs font-semibold">
                  {dateLabel(nextBill.nextDue)} · {nextBill.amount.toLocaleString("en-AE")} {currencySymbol(nextBill.currency)}
                </p>
              </>
            ) : (
              <p className="text-white/70 text-sm font-semibold mt-2">All clear 🎉</p>
            )}
          </div>
        </div>
      </div>

      <div className="text-center pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <button onClick={() => setView("home", false)} className="press inline-flex items-center gap-1.5 text-xs font-bold text-white/80 bg-white/10 px-4 py-2.5 rounded-full">
          <RefreshCw className="w-3.5 h-3.5" /> Updated {format(parseISO(today), "HH:mm")} — open app to edit
        </button>
      </div>
    </div>
  );
}
