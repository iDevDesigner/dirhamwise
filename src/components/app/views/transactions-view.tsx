"use client";

import { useMemo, useState } from "react";
import { useUI } from "@/lib/store";
import { useData } from "@/lib/queries";
import { Card, PageFrame, TxnRow, EmptyState } from "../ui-bits";
import { currencySymbol, monthKey, monthLabel, monthsBack, todayStr } from "@/lib/format";
import { dateLabel } from "@/lib/format";
import { Search, SlidersHorizontal, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { TxnType } from "@/lib/models";
import { Button } from "@/components/ui/button";

type TypeFilter = "all" | TxnType;

export default function TransactionsView() {
  const { data } = useData();
  const back = useUI((s) => s.back);
  const editTxn = useUI((s) => s.editTxn);
  const openAdd = useUI((s) => s.openAdd);

  const [month, setMonth] = useState<string>(monthKey(new Date()));
  const [type, setType] = useState<TypeFilter>("all");
  const [catId, setCatId] = useState<number | "all">("all");
  const [accId, setAccId] = useState<number | "all">("all");
  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const months = useMemo(() => [...monthsBack(12).reverse()]);

  const grouped = useMemo(() => {
    if (!data) return { groups: [] as { date: string; items: typeof data.txns; total: number }[], income: 0, expense: 0 };
    const { start, end } = { start: `${month}-01`, end: `${month}-31` };
    const q = query.trim().toLowerCase();
    const filtered = data.txns
      .filter((t) => (month === "all" ? true : t.date >= start && t.date <= end))
      .filter((t) => (type === "all" ? true : t.type === type))
      .filter((t) => (catId === "all" ? true : t.categoryId === catId))
      .filter((t) => (accId === "all" ? true : t.accountId === accId || (t.type === "transfer" && t.toAccountId === accId)))
      .filter((t) => {
        if (!q) return true;
        const cat = data.categories.find((c) => c.id === t.categoryId)?.name ?? "";
        const acc = data.accounts.find((a) => a.id === t.accountId)?.name ?? "";
        return (t.note + " " + cat + " " + acc).toLowerCase().includes(q);
      })
      .sort((a, b) => (a.date === b.date ? (b.id ?? 0) - (a.id ?? 0) : b.date.localeCompare(a.date)));

    const groups: { date: string; items: typeof filtered; total: number }[] = [];
    const byDate = new Map<string, typeof filtered>();
    let income = 0;
    let expense = 0;
    for (const t of filtered) {
      const arr = byDate.get(t.date) ?? [];
      arr.push(t);
      byDate.set(t.date, arr);
      if (t.type === "expense") expense += t.amount;
      if (t.type === "income") income += t.amount;
    }
    [...byDate.keys()].sort().reverse().forEach((d) => {
      const items = byDate.get(d)!;
      const total = items.reduce((s, t) => s + (t.type === "expense" ? -t.amount : t.type === "income" ? t.amount : 0), 0);
      groups.push({ date: d, items, total });
    });
    return { groups, income, expense };
  }, [data, month, type, catId, accId, query]);

  if (!data) return <div className="min-h-dvh" />;
  const cur = data.settings.baseCurrency;
  const filterActive = type !== "all" || catId !== "all" || accId !== "all";

  return (
    <PageFrame
      title="Transactions"
      subtitle={month === "all" ? "All time" : monthLabel(month)}
      onBack={back}
      actions={
        <button onClick={() => openAdd("expense")} aria-label="Add transaction" className="press w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mr-1">
          <Plus className="w-5 h-5" />
        </button>
      }
    >
      {/* Search + filter toggle */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes, categories, accounts…"
            className="pl-9 h-11 rounded-2xl"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          aria-label="Filters"
          className={cn(
            "press w-11 h-11 rounded-2xl border flex items-center justify-center relative",
            filterActive || showFilters ? "bg-primary/10 border-primary/40 text-primary" : "border-border/60 text-muted-foreground"
          )}
        >
          <SlidersHorizontal className="w-4.5 h-4.5" />
          {filterActive && <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-primary text-[9px] text-primary-foreground font-bold flex items-center justify-center">!</span>}
        </button>
      </div>

      {/* Month chips */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar mt-2.5 -mx-4 px-4">
        {months.map((m) => (
          <button
            key={m}
            onClick={() => setMonth(m)}
            className={cn(
              "shrink-0 h-8 px-3 rounded-full text-xs font-bold press",
              month === m ? "bg-primary text-primary-foreground" : "bg-muted/70 text-muted-foreground"
            )}
          >
            {monthLabel(m).replace(" ", " '")}
          </button>
        ))}
        <button
          onClick={() => setMonth("all")}
          className={cn(
            "shrink-0 h-8 px-3 rounded-full text-xs font-bold press",
            month === "all" ? "bg-primary text-primary-foreground" : "bg-muted/70 text-muted-foreground"
          )}
        >
          All
        </button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <Card className="p-3 mt-2.5 space-y-2.5">
          <div>
            <p className="text-[11px] font-bold uppercase text-muted-foreground mb-1.5">Type</p>
            <div className="flex gap-1.5 flex-wrap">
              {(["all", "expense", "income", "transfer"] as TypeFilter[]).map((t) => (
                <Chip key={t} active={type === t} onClick={() => setType(t)} label={t === "all" ? "All" : t[0].toUpperCase() + t.slice(1)} />
              ))}
            </div>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase text-muted-foreground mb-1.5">Category</p>
            <div className="flex gap-1.5 flex-wrap">
              <Chip active={catId === "all"} onClick={() => setCatId("all")} label="All" />
              {data.categories.filter((c) => c.parentId === null).map((c) => (
                <Chip key={c.id} active={catId === c.id} onClick={() => setCatId(c.id!)} label={c.name} dot={c.color} />
              ))}
            </div>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase text-muted-foreground mb-1.5">Account</p>
            <div className="flex gap-1.5 flex-wrap">
              <Chip active={accId === "all"} onClick={() => setAccId("all")} label="All" />
              {data.accounts.map((a) => (
                <Chip key={a.id} active={accId === a.id} onClick={() => setAccId(a.id!)} label={a.name} />
              ))}
            </div>
          </div>
          {filterActive && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setType("all");
                setCatId("all");
                setAccId("all");
              }}
              className="text-destructive h-8"
            >
              <X className="w-3.5 h-3.5" /> Clear filters
            </Button>
          )}
        </Card>
      )}

      {/* Summary */}
      <div className="flex gap-2 mt-3">
        <div className="flex-1 rounded-2xl bg-income/10 border border-income/20 px-3 py-2">
          <p className="text-[10px] font-bold uppercase text-income/80">Income</p>
          <p className="text-sm font-bold tnum text-income">{grouped.income.toLocaleString("en-AE")} {currencySymbol(cur)}</p>
        </div>
        <div className="flex-1 rounded-2xl bg-expense/10 border border-expense/20 px-3 py-2">
          <p className="text-[10px] font-bold uppercase text-expense/80">Expense</p>
          <p className="text-sm font-bold tnum text-expense">{grouped.expense.toLocaleString("en-AE")} {currencySymbol(cur)}</p>
        </div>
      </div>

      {/* List */}
      {grouped.groups.length === 0 ? (
        <EmptyState icon={<Search className="w-7 h-7" />} title="Nothing found" hint="Try another month, clear filters, or search a different word." />
      ) : (
        <div className="mt-2 space-y-3">
          {grouped.groups.map((g) => (
            <div key={g.date}>
              <div className="flex items-center justify-between px-1.5 mb-1">
                <p className="text-xs font-bold text-muted-foreground">{dateLabel(g.date)}</p>
                <p className={cn("text-xs font-bold tnum", g.total >= 0 ? "text-income" : "text-expense")}>
                  {g.total >= 0 ? "+" : "−"} {Math.abs(g.total).toLocaleString("en-AE")}
                </p>
              </div>
              <Card className="px-2 py-1.5">
                {g.items.map((t) => (
                  <TxnRow
                    key={t.id}
                    txn={t}
                    category={data.categories.find((c) => c.id === t.categoryId)}
                    account={data.accounts.find((a) => a.id === t.accountId)}
                    toAccount={data.accounts.find((a) => a.id === t.toAccountId)}
                    baseCurrency={cur}
                    onClick={() => editTxn(t)}
                  />
                ))}
              </Card>
            </div>
          ))}
        </div>
      )}
    </PageFrame>
  );
}

function Chip({ active, onClick, label, dot }: { active: boolean; onClick: () => void; label: string; dot?: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "h-8 px-3 rounded-full text-xs font-semibold press flex items-center gap-1.5",
        active ? "bg-primary text-primary-foreground" : "bg-muted/70 text-muted-foreground"
      )}
    >
      {dot && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: dot }} />}
      {label}
    </button>
  );
}
