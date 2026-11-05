"use client";

import { useMemo, useState } from "react";
import { useUI } from "@/lib/store";
import {
  computeBalances,
  useBudgets,
  useData,
  useRecentMonthsTotals,
  useRemittances,
  totalsForRange,
  toBase,
} from "@/lib/queries";
import { healthScore } from "@/lib/insights";
import { Card, PageFrame, ProgressRing, SectionTitle, EmptyState } from "../ui-bits";
import { currencySymbol, monthKey, monthLabel, monthRange, monthsBack, todayStr } from "@/lib/format";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Receipt, Send, TrendingUp, Users } from "lucide-react";
import { cn } from "@/lib/utils";

type Period = "month" | "3m" | "6m" | "year" | "all";

export default function StatsView() {
  const { data } = useData();
  const back = useUI((s) => s.back);
  const [period, setPeriod] = useState<Period>("month");
  const monthly = useRecentMonthsTotals(6);
  const remittances = useRemittances();
  const budgets = useBudgets();

  const range = useMemo((): { start: string; end: string; label: string } => {
    const today = todayStr();
    if (period === "month") {
      const r = monthRange(monthKey(new Date()));
      return { ...r, label: monthLabel(monthKey(new Date())) };
    }
    if (period === "3m") {
      const months = monthsBack(3);
      return { start: monthRange(months[0]).start, end: today, label: "Last 3 months" };
    }
    if (period === "6m") {
      const months = monthsBack(6);
      return { start: monthRange(months[0]).start, end: today, label: "Last 6 months" };
    }
    if (period === "year") {
      return { start: `${new Date().getFullYear()}-01-01`, end: today, label: String(new Date().getFullYear()) };
    }
    return { start: "2000-01-01", end: today, label: "All time" };
  }, [period]);

  const totals = useMemo(() => {
    if (!data) return null;
    return totalsForRange(data.txns, data.settings, range.start, range.end);
  }, [data, range]);

  const remStats = useMemo(() => {
    if (!remittances || !data) return null;
    const inRange = remittances.filter((r) => r.date >= range.start && r.date <= range.end);
    const total = inRange.reduce((s, r) => s + toBase(r.amount, r.currency, data.settings), 0);
    const fees = inRange.reduce((s, r) => s + toBase(r.fee, r.currency, data.settings), 0);
    const byCountry = new Map<string, number>();
    const byPurpose = new Map<string, number>();
    for (const r of inRange) {
      const amt = toBase(r.amount, r.currency, data.settings);
      byCountry.set(r.country, (byCountry.get(r.country) ?? 0) + amt);
      byPurpose.set(r.purpose, (byPurpose.get(r.purpose) ?? 0) + amt);
    }
    return {
      count: inRange.length,
      total,
      fees,
      topCountry: [...byCountry.entries()].sort((a, b) => b[1] - a[1])[0],
      topPurpose: [...byPurpose.entries()].sort((a, b) => b[1] - a[1])[0],
    };
  }, [remittances, data, range]);

  const dailyTrend = useMemo(() => {
    if (!data || !totals) return [];
    // cumulative expense by day in range (max 90 days for readability)
    const days: { day: string; spend: number; cum: number }[] = [];
    let cum = 0;
    const byDay = new Map<string, number>();
    for (const t of data.txns) {
      if (t.type !== "expense" || t.date < range.start || t.date > range.end) continue;
      byDay.set(t.date, (byDay.get(t.date) ?? 0) + toBase(t.amount, t.currency, data.settings));
    }
    const keys = [...byDay.keys()].sort();
    for (const k of keys) {
      cum += byDay.get(k) ?? 0;
      days.push({ day: k.slice(5), spend: Math.round(byDay.get(k) ?? 0), cum: Math.round(cum) });
    }
    return days;
  }, [data, totals, range]);

  if (!data || !totals) return <div className="min-h-dvh" />;
  const cur = data.settings.baseCurrency;
  const sym = currencySymbol(cur);

  const pieData = totals.byCategory.slice(0, 9).map((c) => {
    const cat = data.categories.find((x) => x.id === c.categoryId);
    return { name: cat?.name ?? "Other", value: c.total, color: cat?.color ?? "#94a3b8" };
  });
  const othersTotal = totals.byCategory.slice(9).reduce((s, c) => s + c.total, 0);
  if (othersTotal > 0) pieData.push({ name: "Others", value: othersTotal, color: "#cbd5e1" });

  const health = healthScore({
    totals,
    budgets: (budgets ?? []).map((b) => ({ categoryId: b.categoryId, amount: b.amount })),
    accounts: data.accounts
      .filter((a) => a.includeInNet && !a.archived)
      .map((a) => ({ balanceBase: computeBalances(data.accounts, data.txns, data.settings)[a.id!]?.balanceBase ?? 0 })),
    goals: [],
    bills: [],
    remittances: remittances ?? [],
    txns: data.txns,
    settings: data.settings,
  });

  return (
    <PageFrame title="Statistics" subtitle={range.label} onBack={back}>
      {/* Period chips */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4">
        {(["month", "3m", "6m", "year", "all"] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={cn(
              "shrink-0 h-8 px-3.5 rounded-full text-xs font-bold press",
              period === p ? "bg-primary text-primary-foreground" : "bg-muted/70 text-muted-foreground"
            )}
          >
            {p === "month" ? "This month" : p === "3m" ? "3 months" : p === "6m" ? "6 months" : p === "year" ? "Year" : "All time"}
          </button>
        ))}
      </div>

      {/* Top numbers */}
      <div className="grid grid-cols-3 gap-2 mt-3">
        <NumBox label="Income" value={totals.income} cls="text-income" />
        <NumBox label="Expense" value={totals.expense} cls="text-expense" />
        <NumBox label="Net" value={totals.income - totals.expense} cls={totals.income - totals.expense >= 0 ? "text-income" : "text-expense"} />
      </div>

      {/* Category donut */}
      <SectionTitle>Where money goes</SectionTitle>
      {totals.expense <= 0 ? (
        <Card className="p-2">
          <EmptyState icon={<TrendingUp className="w-7 h-7" />} title="No expenses in this period" hint="Add a few transactions and the charts will come alive." />
        </Card>
      ) : (
        <Card className="p-4">
          <div className="h-56 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={64} outerRadius={92} paddingAngle={2} strokeWidth={0}>
                  {pieData.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number, n: string) => [`${v.toLocaleString("en-AE")} ${sym}`, n]}
                  contentStyle={{ borderRadius: 16, border: "1px solid rgba(0,0,0,0.08)", fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Total spent</span>
              <span className="text-xl font-extrabold tnum">{totals.expense.toLocaleString("en-AE")}</span>
              <span className="text-[10px] text-muted-foreground font-bold">{sym}</span>
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            {pieData.map((d, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                <span className="flex-1 truncate font-medium">{d.name}</span>
                <span className="text-muted-foreground tnum">{Math.round((d.value / totals.expense) * 100)}%</span>
                <span className="font-bold tnum w-24 text-right">{d.value.toLocaleString("en-AE")}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Income vs expense bars */}
      {monthly && monthly.some((m) => m.income > 0 || m.expense > 0) && (
        <>
          <SectionTitle>Income vs expense</SectionTitle>
          <Card className="p-4">
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthly} barGap={3}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128,128,128,0.15)" />
                  <XAxis dataKey="month" tickFormatter={(m: string) => monthLabel(m).split(" ")[0].slice(0, 3)} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={44} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
                  <Tooltip
                    formatter={(v: number, n: string) => [`${v.toLocaleString("en-AE")} ${sym}`, n === "income" ? "Income" : "Expense"]}
                    labelFormatter={(m: string) => monthLabel(m)}
                    contentStyle={{ borderRadius: 16, border: "1px solid rgba(0,0,0,0.08)", fontSize: 12 }}
                  />
                  <Bar dataKey="income" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={26} />
                  <Bar dataKey="expense" fill="#f43f5e" radius={[6, 6, 0, 0]} maxBarSize={26} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </>
      )}

      {/* Daily cumulative trend */}
      {dailyTrend.length > 1 && (
        <>
          <SectionTitle>Cumulative spending</SectionTitle>
          <Card className="p-4">
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyTrend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128,128,128,0.15)" />
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={44} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
                  <Tooltip formatter={(v: number) => [`${v.toLocaleString("en-AE")} ${sym}`, "Cumulative"]} contentStyle={{ borderRadius: 16, border: "1px solid rgba(0,0,0,0.08)", fontSize: 12 }} />
                  <Line type="monotone" dataKey="cum" stroke="#0d9488" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </>
      )}

      {/* VAT report */}
      <SectionTitle>UAE VAT (5%)</SectionTitle>
      <Card className="p-4 flex items-center gap-4">
        <span className="w-12 h-12 rounded-2xl bg-gold/15 text-gold flex items-center justify-center shrink-0">
          <Receipt className="w-6 h-6" />
        </span>
        <div className="flex-1">
          <p className="text-sm font-bold tnum">{totals.vatTotal.toLocaleString("en-AE")} {sym}</p>
          <p className="text-xs text-muted-foreground">VAT included in tagged expenses for this period</p>
        </div>
      </Card>

      {/* Remittance stats */}
      {remStats && remStats.count > 0 && (
        <>
          <SectionTitle>Money sent home</SectionTitle>
          <Card className="p-4 space-y-2.5">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Send className="w-5 h-5" />
              </span>
              <div className="flex-1">
                <p className="text-lg font-extrabold tnum">{remStats.total.toLocaleString("en-AE")} {sym}</p>
                <p className="text-[11px] text-muted-foreground">{remStats.count} transfers · fees {remStats.fees.toLocaleString("en-AE")} {sym}</p>
              </div>
            </div>
            {remStats.topCountry && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Users className="w-3.5 h-3.5" />
                Top corridor: <b className="text-foreground">{remStats.topCountry[0]}</b> ({remStats.topCountry[1].toLocaleString("en-AE")} {sym})
              </div>
            )}
            {remStats.topPurpose && (
              <div className="text-xs text-muted-foreground">
                Main purpose: <b className="text-foreground">{remStats.topPurpose[0]}</b>
              </div>
            )}
          </Card>
        </>
      )}

      {/* Health breakdown */}
      <SectionTitle>Money health</SectionTitle>
      <Card className="p-4">
        <div className="flex items-center gap-4 mb-3">
          <ProgressRing pct={health.score} color={health.color} size={84}>
            <span className="text-2xl font-extrabold tnum">{health.score}</span>
            <span className="text-[9px] text-muted-foreground font-bold uppercase">{health.band}</span>
          </ProgressRing>
          <div className="flex-1 space-y-2">
            {health.parts.map((p) => (
              <div key={p.label}>
                <div className="flex justify-between text-[11px] font-semibold">
                  <span>{p.label}</span>
                  <span className="tnum text-muted-foreground">{p.pts}/{p.max}</span>
                </div>
                <div className="h-1.5 rounded-full bg-foreground/8 overflow-hidden mt-0.5">
                  <div className="h-full rounded-full" style={{ width: `${(p.pts / p.max) * 100}%`, backgroundColor: health.color }} />
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{p.hint}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </PageFrame>
  );
}

function NumBox({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div className="rounded-2xl bg-card border border-border/70 px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("text-base font-extrabold tnum mt-0.5", cls)}>{value.toLocaleString("en-AE")}</p>
    </div>
  );
}
