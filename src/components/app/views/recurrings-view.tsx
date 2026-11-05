"use client";

import { useUI } from "@/lib/store";
import { useData, useRecurrings } from "@/lib/queries";
import { Card, CatIcon, EmptyState, PageFrame } from "../ui-bits";
import { currencySymbol, dateLabel, todayStr } from "@/lib/format";
import { db } from "@/lib/db";
import { FREQ_LABEL } from "@/lib/recurring";
import { toast } from "sonner";
import { Repeat, Trash2, PlayCircle, PauseCircle, Check } from "lucide-react";
import { format, addDays, addMonths, addYears } from "date-fns";
import type { Recurring } from "@/lib/models";

export default function RecurringsView() {
  const { data } = useData();
  const back = useUI((s) => s.back);
  const rules = useRecurrings();
  if (!data) return <div className="min-h-dvh" />;
  const active = (rules ?? []).filter((r) => r.active);
  const paused = (rules ?? []).filter((r) => !r.active);

  const postNow = async (r: Recurring) => {
    const now = new Date().toISOString();
    await db.txns.add({
      type: r.type,
      amount: r.amount,
      currency: r.currency,
      categoryId: r.categoryId,
      accountId: r.accountId,
      toAccountId: r.toAccountId,
      date: todayStr(),
      note: r.note,
      vat: r.vat,
      vatRate: r.vatRate,
      recurringId: r.id ?? null,
      createdAt: now,
      updatedAt: now,
    });
    await db.recurrings.update(r.id!, { lastPosted: todayStr(), nextDate: advance(r.nextDate, r.frequency) });
    toast.success("Posted to ledger");
  };

  return (
    <PageFrame title="Recurring rules" subtitle="Rent, salary, subscriptions — automated" onBack={back}>
      {active.length === 0 && paused.length === 0 ? (
        <EmptyState
          icon={<Repeat className="w-7 h-7" />}
          title="No recurring rules"
          hint="When adding a transaction, flip on “Repeat automatically” — perfect for rent, salary, school fees and memberships."
        />
      ) : (
        <div className="space-y-2">
          {active.map((r) => {
            const cat = data.categories.find((c) => c.id === r.categoryId);
            const acc = data.accounts.find((a) => a.id === r.accountId);
            return (
              <Card key={r.id} className="p-3.5">
                <div className="flex items-center gap-3">
                  <CatIcon category={cat ?? null} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{r.note || FREQ_LABEL[r.frequency]}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {FREQ_LABEL[r.frequency]} · {acc?.name ?? ""} · {r.autoPost ? "auto-posts" : "waits for you"}
                    </p>
                    <p className="text-[11px] font-semibold text-primary mt-0.5">Next: {dateLabel(r.nextDate)}</p>
                  </div>
                  <p className="text-sm font-bold tnum shrink-0">
                    {r.type === "income" ? "+" : "−"}
                    {r.amount.toLocaleString("en-AE")} {currencySymbol(r.currency)}
                  </p>
                </div>
                <div className="flex gap-2 mt-2.5">
                  {!r.autoPost && (
                    <button onClick={() => postNow(r)} className="press flex-1 h-9 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-1.5">
                      <Check className="w-4 h-4" /> Post now
                    </button>
                  )}
                  <button
                    onClick={async () => {
                      await db.recurrings.update(r.id!, { active: 0 });
                      toast("Paused");
                    }}
                    className="press h-9 px-3 rounded-xl bg-muted text-xs font-bold flex items-center gap-1"
                  >
                    <PauseCircle className="w-3.5 h-3.5" /> Pause
                  </button>
                  <button
                    onClick={async () => {
                      await db.recurrings.delete(r.id!);
                      toast("Rule deleted");
                    }}
                    className="press h-9 px-3 rounded-xl bg-muted text-xs font-bold text-destructive flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </Card>
            );
          })}
          {paused.length > 0 && (
            <>
              <p className="text-[13px] font-bold uppercase tracking-wider text-muted-foreground mt-4 mb-1">Paused</p>
              {paused.map((r) => (
                <Card key={r.id} className="p-3 flex items-center gap-3 opacity-70">
                  <Repeat className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{r.note || "Recurring"}</p>
                    <p className="text-[11px] text-muted-foreground">{FREQ_LABEL[r.frequency]}</p>
                  </div>
                  <button
                    onClick={async () => {
                      await db.recurrings.update(r.id!, { active: 1 });
                      toast("Resumed");
                    }}
                    aria-label="Resume"
                    className="press w-9 h-9 rounded-xl bg-muted flex items-center justify-center text-primary"
                  >
                    <PlayCircle className="w-4 h-4" />
                  </button>
                  <button
                    onClick={async () => {
                      await db.recurrings.delete(r.id!);
                      toast("Deleted");
                    }}
                    aria-label="Delete"
                    className="press w-9 h-9 rounded-xl bg-muted flex items-center justify-center text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </Card>
              ))}
            </>
          )}
        </div>
      )}
    </PageFrame>
  );
}

function advance(date: string, freq: Recurring["frequency"]): string {
  const d = new Date(date + "T12:00:00");
  switch (freq) {
    case "daily": return format(addDays(d, 1), "yyyy-MM-dd");
    case "weekly": return format(addDays(d, 7), "yyyy-MM-dd");
    case "biweekly": return format(addDays(d, 14), "yyyy-MM-dd");
    case "monthly": return format(addMonths(d, 1), "yyyy-MM-dd");
    case "quarterly": return format(addMonths(d, 3), "yyyy-MM-dd");
    case "yearly": return format(addYears(d, 1), "yyyy-MM-dd");
    default: return format(addMonths(d, 1), "yyyy-MM-dd");
  }
}
