"use client";

import { useMemo, useState } from "react";
import { useUI } from "@/lib/store";
import { useData } from "@/lib/queries";
import { Card, PageFrame, TxnRow, EmptyState } from "../ui-bits";
import { currencySymbol, monthKey, monthLabel, todayStr } from "@/lib/format";
import { ChevronLeft, ChevronRight, Plus, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, parseISO } from "date-fns";

export default function CalendarView() {
  const { data } = useData();
  const back = useUI((s) => s.back);
  const openAdd = useUI((s) => s.openAdd);
  const editTxn = useUI((s) => s.editTxn);
  const [cursor, setCursor] = useState(new Date());
  const [selected, setSelected] = useState(todayStr());

  const byDay = useMemo(() => {
    const map = new Map<string, { income: number; expense: number; count: number }>();
    if (!data) return map;
    for (const t of data.txns) {
      if (t.type === "transfer") continue;
      const e = map.get(t.date) ?? { income: 0, expense: 0, count: 0 };
      const amt = t.currency === data.settings.baseCurrency ? t.amount : t.amount * (data.settings.rates[t.currency] ?? 1);
      if (t.type === "expense") e.expense += amt;
      else e.income += amt;
      e.count++;
      map.set(t.date, e);
    }
    return map;
  }, [data]);

  const weeks = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });
    const days = eachDayOfInterval({ start, end });
    const out: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) out.push(days.slice(i, i + 7));
    return out;
  }, [cursor]);

  if (!data) return <div className="min-h-dvh" />;
  const cur = data.settings.baseCurrency;
  const sel = byDay.get(selected);
  const dayTxns = data.txns.filter((t) => t.date === selected).sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
  const monthExpense = [...byDay.entries()]
    .filter(([d]) => d.startsWith(monthKey(cursor)))
    .reduce((s, [, v]) => s + v.expense, 0);

  return (
    <PageFrame title="Calendar" subtitle={`${monthLabel(monthKey(cursor))} · spent ${monthExpense.toLocaleString("en-AE")} ${cur}`} onBack={back}>
      <Card className="p-3">
        {/* Month nav */}
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} className="press w-9 h-9 rounded-full hover:bg-accent flex items-center justify-center" aria-label="Previous month">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <p className="font-bold text-sm">{monthLabel(monthKey(cursor))}</p>
          <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} className="press w-9 h-9 rounded-full hover:bg-accent flex items-center justify-center" aria-label="Next month">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        {/* Weekday header */}
        <div className="grid grid-cols-7 mb-1">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <div key={i} className="text-center text-[10px] font-bold text-muted-foreground py-1">
              {d}
            </div>
          ))}
        </div>
        {/* Grid */}
        <div className="space-y-1">
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 gap-1">
              {week.map((d) => {
                const key = format(d, "yyyy-MM-dd");
                const stat = byDay.get(key);
                const inMonth = isSameMonth(d, cursor);
                const isSel = key === selected;
                return (
                  <button
                    key={key}
                    onClick={() => setSelected(key)}
                    className={cn(
                      "h-14 rounded-xl flex flex-col items-center justify-start pt-1 relative press",
                      isSel ? "bg-primary text-primary-foreground shadow" : inMonth ? "hover:bg-accent" : "opacity-35"
                    )}
                  >
                    <span className={cn("text-xs font-bold", isSameDay(d, parseISO(todayStr())) && !isSel && "text-primary underline underline-offset-2")}>
                      {format(d, "d")}
                    </span>
                    {stat && stat.expense > 0 && (
                      <span className={cn("text-[8.5px] font-bold tnum leading-tight mt-0.5 px-0.5", isSel ? "text-primary-foreground/90" : "text-expense")}>
                        −{Math.round(stat.expense)}
                      </span>
                    )}
                    {stat && stat.income > 0 && (
                      <span className={cn("text-[8.5px] font-bold tnum leading-tight", isSel ? "text-primary-foreground/90" : "text-income")}>
                        +{Math.round(stat.income)}
                      </span>
                    )}
                    {stat && (
                      <span className={cn("absolute bottom-1 w-1 h-1 rounded-full", isSel ? "bg-primary-foreground" : stat.expense > 0 ? "bg-expense/60" : "bg-income/60")} />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </Card>

      {/* Selected day */}
      <div className="mt-3">
        <div className="flex items-center justify-between px-1.5 mb-1">
          <p className="text-xs font-bold text-muted-foreground">
            {isSameDay(parseISO(selected), new Date()) ? "Today" : format(parseISO(selected), "EEEE, d MMM yyyy")}
          </p>
          {sel && (
            <p className="text-xs font-bold">
              {sel.expense > 0 && <span className="text-expense tnum">−{sel.expense.toLocaleString("en-AE")} </span>}
              {sel.income > 0 && <span className="text-income tnum">+{sel.income.toLocaleString("en-AE")}</span>}
            </p>
          )}
        </div>
        <Card className="px-2 py-1.5">
          {dayTxns.length === 0 ? (
            <EmptyState
              icon={<CalendarDays className="w-7 h-7" />}
              title="Nothing on this day"
              hint="Tap + to add a transaction for the selected date."
              action={
                <button onClick={() => openAdd("expense", selected)} className="press h-9 px-4 rounded-xl hero-grad text-white text-xs font-bold flex items-center gap-1.5">
                  <Plus className="w-4 h-4" /> Add for {format(parseISO(selected), "d MMM")}
                </button>
              }
            />
          ) : (
            dayTxns.map((t) => (
              <TxnRow
                key={t.id}
                txn={t}
                category={data.categories.find((c) => c.id === t.categoryId)}
                account={data.accounts.find((a) => a.id === t.accountId)}
                toAccount={data.accounts.find((a) => a.id === t.toAccountId)}
                baseCurrency={cur}
                onClick={() => editTxn(t)}
              />
            ))
          )}
        </Card>
      </div>
    </PageFrame>
  );
}
