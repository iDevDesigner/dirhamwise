"use client";

import { useMemo } from "react";
import { useUI } from "@/lib/store";
import {
  computeBalances,
  netWorthOf,
  useBudgets,
  useData,
  useMonthTotals,
  useRemittances,
  useUpcoming,
  budgetProgressFor,
} from "@/lib/queries";
import { dailyInsights, healthScore, type Insight } from "@/lib/insights";
import { currencySymbol, dateLabel, monthKey, monthLabel, todayStr } from "@/lib/format";
import { Card, EmptyState, PageFrame, ProgressRing, SectionTitle, TxnRow, AccIcon, accountColor } from "../ui-bits";
import { LiveRateCard } from "../widgets/rate-card";
import { iconFor } from "@/lib/icons";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Calculator,
  ChevronRight,
  Eye,
  Landmark,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FREQ_LABEL } from "@/lib/recurring";
import { format, parseISO } from "date-fns";
import React from "react";

export default function HomeView() {
  const { data } = useData();
  const month = monthKey(new Date());
  const totals = useMonthTotals(month);
  const lastTotals = useMonthTotals(monthKeyOfPrev());
  const budgets = useBudgets();
  const billsQ = useUpcoming();
  const remittances = useRemittances();
  const setView = useUI((s) => s.setView);
  const openAdd = useUI((s) => s.openAdd);

  const { net, balances } = useMemo(() => {
    if (!data) return { net: 0, balances: {} as ReturnType<typeof computeBalances> };
    const b = computeBalances(data.accounts, data.txns, data.settings);
    return { net: netWorthOf(data.accounts, b), balances: b };
  }, [data]);

  const health = useMemo(() => {
    if (!data || !totals) return null;
    return healthScore({
      totals,
      lastMonthTotals: lastTotals,
      budgets: (budgets ?? []).map((b) => ({ categoryId: b.categoryId, amount: b.amount })),
      accounts: data.accounts.filter((a) => a.includeInNet && !a.archived).map((a) => ({ balanceBase: balances[a.id!]?.balanceBase ?? 0 })),
      goals: [],
      bills: billsQ?.bills ?? [],
      remittances: remittances ?? [],
      txns: data.txns,
      settings: data.settings,
    });
  }, [data, totals, lastTotals, budgets, balances, billsQ, remittances]);

  const insights = useMemo((): Insight[] => {
    if (!data || !totals) return [];
    return dailyInsights({
      totals,
      budgets: (budgets ?? []).map((b) => ({ categoryId: b.categoryId, amount: b.amount })),
      categories: data.categories,
      bills: billsQ?.bills ?? [],
      remittances: remittances ?? [],
      lastMonthTotals: lastTotals,
      settings: data.settings,
    });
  }, [data, totals, budgets, billsQ, remittances, lastTotals]);

  if (!data || !totals) return <div className="min-h-dvh" />;

  const cur = data.settings.baseCurrency;
  const sym = currencySymbol(cur);
  const overallBudget = budgets?.find((b) => b.categoryId === null);
  const { overall } = budgetProgressFor(budgets ?? [], totals, data.categories);
  const recent = [...data.txns].sort((a, b) => (a.date === b.date ? (b.id ?? 0) - (a.id ?? 0) : b.date.localeCompare(a.date))).slice(0, 8);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const name = data.settings.profileName;

  return (
    <PageFrame
      title={name ? `${greeting}, ${name}` : greeting}
      subtitle={format(new Date(), "EEEE, d MMMM yyyy")}
      actions={
        <button onClick={() => setView("glance")} aria-label="Glance mode" className="press w-10 h-10 rounded-full hover:bg-accent flex items-center justify-center text-muted-foreground">
          <Eye className="w-5 h-5" />
        </button>
      }
    >
      {/* Hero */}
      <div className="hero-grad rounded-3xl p-5 text-white shadow-lg shadow-emerald-900/20 relative overflow-hidden">
        <p className="text-white/75 text-xs font-semibold uppercase tracking-wider">Net worth · all accounts</p>
        <div className="flex items-end gap-2 mt-1">
          <p className="text-4xl font-extrabold tnum tracking-tight">{net.toLocaleString("en-AE", { minimumFractionDigits: 2 })}</p>
          <span className="text-white/80 font-bold mb-1">{cur}</span>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-4">
          <div className="rounded-2xl bg-white/10 backdrop-blur px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[11px] text-white/75 font-semibold">
              <ArrowDownLeft className="w-3.5 h-3.5" /> INCOME · {monthLabel(month).split(" ")[0]}
            </div>
            <p className="text-lg font-bold tnum mt-0.5">{totals.income.toLocaleString("en-AE")}</p>
          </div>
          <div className="rounded-2xl bg-white/10 backdrop-blur px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[11px] text-white/75 font-semibold">
              <ArrowUpRight className="w-3.5 h-3.5" /> SPENT · {monthLabel(month).split(" ")[0]}
            </div>
            <p className="text-lg font-bold tnum mt-0.5">{totals.expense.toLocaleString("en-AE")}</p>
          </div>
        </div>
        {overall && (
          <div className="mt-3">
            <div className="flex justify-between text-[11px] text-white/75 font-semibold mb-1">
              <span>MONTHLY BUDGET</span>
              <span>
                {overall.pct}% · {sym} {Math.abs(overall.left).toLocaleString("en-AE")} {overall.left >= 0 ? "left" : "over"}
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/20 overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all", overall.pct > 100 ? "bg-red-300" : overall.pct > 85 ? "bg-amber-300" : "bg-white")}
                style={{ width: `${Math.min(100, overall.pct)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Live AED→INR */}
      <div className="mt-4">
        <LiveRateCard />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-4 gap-2 mt-4">
        {[
          { label: "Expense", icon: ArrowUpRight, cls: "text-expense bg-expense/10", act: () => openAdd("expense") },
          { label: "Income", icon: ArrowDownLeft, cls: "text-income bg-income/10", act: () => openAdd("income") },
          { label: "Transfer", icon: ArrowLeftRight, cls: "text-foreground bg-muted", act: () => openAdd("transfer") },
          { label: "Accounts", icon: Landmark, cls: "text-primary bg-primary/10", act: () => setView("accounts") },
        ].map((a) => {
          const Icon = a.icon;
          return (
            <button key={a.label} onClick={a.act} className="press flex flex-col items-center gap-1.5 py-2.5">
              <span className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", a.cls)}>
                <Icon className="w-5.5 h-5.5" />
              </span>
              <span className="text-[11px] font-semibold text-muted-foreground">{a.label}</span>
            </button>
          );
        })}
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <>
          <SectionTitle>Today&apos;s insights</SectionTitle>
          <div className="flex gap-2.5 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
            {insights.map((ins, i) => (
              <InsightCard key={i} insight={ins} categories={data.categories} />
            ))}
          </div>
        </>
      )}

      {/* Health score */}
      {health && (
        <Card className="p-4 mt-4">
          <div className="flex items-center gap-4">
            <ProgressRing pct={health.score} color={health.color} size={78}>
              <span className="text-xl font-extrabold tnum">{health.score}</span>
            </ProgressRing>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" style={{ color: health.color }} />
                <p className="font-bold text-sm">Money health: {health.band}</p>
              </div>
              <ul className="mt-1.5 space-y-0.5">
                {health.parts.slice(0, 2).map((p) => (
                  <li key={p.label} className="text-[11px] text-muted-foreground leading-snug">
                    <b className="text-foreground/80">{p.label}:</b> {p.hint}
                  </li>
                ))}
              </ul>
              <button onClick={() => setView("stats")} className="text-[11px] font-bold text-primary mt-1.5 flex items-center gap-0.5 press">
                See full breakdown <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Upcoming */}
      {(billsQ?.bills.length ?? 0) + (billsQ?.recurrings.length ?? 0) > 0 && (
        <>
          <SectionTitle
            action={
              <button onClick={() => setView("bills")} className="text-xs font-bold text-primary press">
                Manage
              </button>
            }
          >
            Upcoming
          </SectionTitle>
          <Card className="divide-y divide-border/60 px-3 py-1">
            {billsQ?.bills.slice(0, 3).map((b) => {
              const daysLeft = Math.round((parseISO(b.nextDue).getTime() - parseISO(todayStr()).getTime()) / 86400000);
              return (
                <div key={b.id} className="flex items-center gap-3 py-2.5">
                  <span className="w-9 h-9 rounded-xl bg-gold/15 text-gold flex items-center justify-center shrink-0">
                    <Bell className="w-4.5 h-4.5" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{b.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Due {dateLabel(b.nextDue)} · {daysLeft <= 0 ? "today" : `in ${daysLeft}d`}
                    </p>
                  </div>
                  <p className="text-sm font-bold tnum">
                    {b.amount.toLocaleString("en-AE")} <span className="text-[10px] text-muted-foreground">{currencySymbol(b.currency)}</span>
                  </p>
                </div>
              );
            })}
            {billsQ?.recurrings.slice(0, 2).map((r) => (
              <div key={r.id} className="flex items-center gap-3 py-2.5">
                <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  {React.createElement(iconFor("Repeat"), { className: "w-4.5 h-4.5" })}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{r.note || "Recurring"}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {FREQ_LABEL[r.frequency]} · {r.autoPost ? "auto-posts" : "reminds"} from {dateLabel(r.nextDate)}
                  </p>
                </div>
                <p className="text-sm font-bold tnum">
                  {r.amount.toLocaleString("en-AE")} <span className="text-[10px] text-muted-foreground">{currencySymbol(r.currency)}</span>
                </p>
              </div>
            ))}
          </Card>
        </>
      )}

      {/* Recent transactions */}
      <SectionTitle
        action={
          <button onClick={() => setView("transactions")} className="text-xs font-bold text-primary press flex items-center">
            See all <ArrowRight className="w-3.5 h-3.5" />
          </button>
        }
      >
        Recent transactions
      </SectionTitle>
      <Card className="px-2 py-1.5">
        {recent.length === 0 ? (
          <EmptyState
            icon={<Sparkles className="w-7 h-7" />}
            title="No transactions yet"
            hint="Tap the big + button to log your first expense — your café karak counts!"
          />
        ) : (
          recent.map((t) => (
            <TxnRow
              key={t.id}
              txn={t}
              category={data.categories.find((c) => c.id === t.categoryId)}
              account={data.accounts.find((a) => a.id === t.accountId)}
              toAccount={data.accounts.find((a) => a.id === t.toAccountId)}
              baseCurrency={cur}
              onClick={() => useUI.getState().editTxn(t)}
            />
          ))
        )}
      </Card>

      {/* Accounts snapshot */}
      <SectionTitle
        action={
          <button onClick={() => setView("accounts")} className="text-xs font-bold text-primary press flex items-center">
            Manage <ArrowRight className="w-3.5 h-3.5" />
          </button>
        }
      >
        Accounts
      </SectionTitle>
      <div className="flex gap-2.5 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
        {data.accounts.filter((a) => !a.archived).map((a) => (
          <div key={a.id} className="min-w-[150px] rounded-2xl p-3.5 text-white press" style={{ background: `linear-gradient(135deg, ${accountColor(a.color)}, ${accountColor(a.color)}cc)` }}>
            <div className="flex items-center gap-1.5 opacity-90">
              <AccIcon account={a} size="sm" />
              <span className="text-xs font-bold truncate">{a.name}</span>
            </div>
            <p className="text-xl font-extrabold tnum mt-2">
              {(balances[a.id!]?.balance ?? 0).toLocaleString("en-AE", { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] font-semibold text-white/70 mt-0.5">{a.currency}</p>
          </div>
        ))}
      </div>

      <p className="text-center text-[10px] text-muted-foreground mt-6">
        DirhamWise · offline-first · data stays on this device unless Cloud Sync is on
      </p>
    </PageFrame>
  );
}

function InsightCard({ insight, categories }: { insight: Insight; categories: { id?: number; icon: string }[] }) {
  const toneCls =
    insight.tone === "good"
      ? "bg-income/10 border-income/25"
      : insight.tone === "warn"
        ? "bg-expense/10 border-expense/25"
        : "bg-card border-border/70";
  void categories;
  return (
    <div className={cn("min-w-[240px] max-w-[260px] rounded-2xl border p-3.5", toneCls)}>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="w-8 h-8 rounded-xl bg-background/70 flex items-center justify-center">
          {React.createElement(iconFor(insight.icon), { className: "w-4 h-4 text-primary" })}
        </span>
        <Calculator className="w-3.5 h-3.5 text-muted-foreground/50 ml-auto" />
      </div>
      <p className="text-[13px] font-medium leading-snug">{insight.text}</p>
    </div>
  );
}

function monthKeyOfPrev(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return monthKey(d);
}
