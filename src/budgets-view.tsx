"use client";

import { useMemo, useState } from "react";
import { useUI } from "@/lib/store";
import { budgetProgressFor, useBudgets, useData, useMonthTotals } from "@/lib/queries";
import { Card, CatIcon, EmptyState, PageFrame, ProgressRing, SectionTitle } from "../ui-bits";
import { currencySymbol, daysInMonth, monthLabel, monthKey } from "@/lib/format";
import { db } from "@/lib/db";
import { toast } from "sonner";
import { Plus, Target, Pencil, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Budget } from "@/lib/models";

export default function BudgetsView() {
  const { data } = useData();
  const back = useUI((s) => s.back);
  const budgets = useBudgets();
  const totals = useMonthTotals(monthKey(new Date()));
  const [editing, setEditing] = useState<Budget | null>(null);
  const [dlgOpen, setDlgOpen] = useState(false);

  const progress = useMemo(
    () => (budgets && data ? budgetProgressFor(budgets, totals, data.categories) : { overall: null, perCategory: [] }),
    [budgets, totals, data]
  );

  if (!data) return <div className="min-h-dvh" />;
  const cur = data.settings.baseCurrency;
  const sym = currencySymbol(cur);
  const days = daysInMonth(monthKey(new Date()));
  const dayNum = new Date().getDate();
  const daysLeft = Math.max(1, days - dayNum + 1);

  return (
    <PageFrame
      title="Budgets"
      subtitle={`${monthLabel(monthKey(new Date()))} · ${daysLeft} days left`}
      onBack={back}
      actions={
        <button
          onClick={() => {
            setEditing(null);
            setDlgOpen(true);
          }}
          aria-label="Add budget"
          className="press w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mr-1"
        >
          <Plus className="w-5 h-5" />
        </button>
      }
    >
      {/* Overall */}
      {progress.overall ? (
        <Card className="p-4">
          <div className="flex items-center gap-4">
            <ProgressRing pct={progress.overall.pct} size={96} color={progress.overall.pct > 100 ? "#ef4444" : progress.overall.pct > 85 ? "#f59e0b" : "#059669"}>
              <span className="text-2xl font-extrabold tnum">{progress.overall.pct}%</span>
              <span className="text-[9px] font-bold text-muted-foreground uppercase">used</span>
            </ProgressRing>
            <div className="flex-1">
              <p className="text-xs font-bold uppercase text-muted-foreground">Monthly budget</p>
              <p className="text-xl font-extrabold tnum">{progress.overall.budget.amount.toLocaleString("en-AE")} {sym}</p>
              <p className={cn("text-sm font-bold tnum mt-0.5", progress.overall.left >= 0 ? "text-income" : "text-expense")}>
                {progress.overall.left >= 0 ? `${progress.overall.left.toLocaleString("en-AE")} ${sym} left` : `${Math.abs(progress.overall.left).toLocaleString("en-AE")} ${sym} over`}
              </p>
              {progress.overall.left > 0 && (
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  ≈ {Math.round(progress.overall.left / daysLeft).toLocaleString("en-AE")} {sym}/day for {daysLeft} days
                </p>
              )}
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => {
                    setEditing(progress.overall!.budget);
                    setDlgOpen(true);
                  }}
                  className="press text-xs font-bold text-primary flex items-center gap-1"
                >
                  <Pencil className="w-3 h-3" /> Edit
                </button>
                <button
                  onClick={async () => {
                    await db.budgets.delete(progress.overall!.budget.id!);
                    toast("Budget removed");
                  }}
                  className="press text-xs font-bold text-destructive flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> Remove
                </button>
              </div>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="p-1">
          <EmptyState
            icon={<Target className="w-7 h-7" />}
            title="No monthly budget yet"
            hint="A total monthly budget is the #1 habit of expats who save. Set one — you can change it anytime."
            action={
              <button
                onClick={() => {
                  setEditing(null);
                  setDlgOpen(true);
                }}
                className="press h-10 px-5 rounded-xl hero-grad text-white text-sm font-bold"
              >
                Set monthly budget
              </button>
            }
          />
        </Card>
      )}

      {/* Per category */}
      <SectionTitle>Category limits</SectionTitle>
      {progress.perCategory.length === 0 ? (
        <Card className="p-1">
          <EmptyState
            icon={<Plus className="w-7 h-7" />}
            title="Limit your big categories"
            hint="Groceries, dining, transport — cap the categories that tend to leak."
            action={
              <button
                onClick={() => {
                  setEditing(null);
                  setDlgOpen(true);
                }}
                className="press h-10 px-5 rounded-xl bg-accent text-accent-foreground text-sm font-bold"
              >
                Add category limit
              </button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-2">
          {progress.perCategory.map((p) => {
            const cat = data.categories.find((c) => c.id === p.budget.categoryId);
            const over = p.pct >= 100;
            return (
              <Card key={p.budget.id} className="p-3.5">
                <div className="flex items-center gap-3">
                  <CatIcon category={cat ?? null} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm font-bold truncate">{cat?.name ?? "Category"}</p>
                      <p className="text-xs tnum font-bold shrink-0">
                        <span className={over ? "text-expense" : ""}>{p.spent.toLocaleString("en-AE")}</span>
                        <span className="text-muted-foreground"> / {p.budget.amount.toLocaleString("en-AE")}</span>
                      </p>
                    </div>
                    <div className="h-2 rounded-full bg-foreground/8 overflow-hidden mt-1.5">
                      <div
                        className={cn("h-full rounded-full transition-all", over ? "bg-expense" : p.pct > 85 ? "bg-gold" : "bg-primary")}
                        style={{ width: `${p.pct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <p className="text-[11px] text-muted-foreground">{p.pct}% used</p>
                      <div className="flex gap-2.5">
                        <button onClick={() => { setEditing(p.budget); setDlgOpen(true); }} className="press text-[11px] font-bold text-primary flex items-center gap-0.5">
                          <Pencil className="w-3 h-3" /> Edit
                        </button>
                        <button
                          onClick={async () => {
                            await db.budgets.delete(p.budget.id!);
                            toast("Budget removed");
                          }}
                          className="press text-[11px] font-bold text-destructive flex items-center gap-0.5"
                        >
                          <Trash2 className="w-3 h-3" /> Remove
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <BudgetDialog key={editing ? `e-${editing.id}` : "new"} open={dlgOpen} onClose={() => setDlgOpen(false)} editing={editing} categories={data.categories.filter((c) => c.type === "expense" && c.parentId === null)} />
    </PageFrame>
  );
}

function BudgetDialog({
  open,
  onClose,
  editing,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  editing: Budget | null;
  categories: { id?: number; name: string; color: string }[];
}) {
  const [catId, setCatId] = useState<string>(editing?.categoryId === null ? "overall" : String(editing?.categoryId ?? "overall"));
  const [amount, setAmount] = useState(String(editing?.amount ?? ""));

  const save = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      toast.error("Enter a budget amount");
      return;
    }
    const categoryId = catId === "overall" ? null : Number(catId);
    if (categoryId === null && editing?.categoryId === null) {
      // updating overall
      await db.budgets.update(editing.id!, { amount: amt });
    } else if (editing?.id) {
      await db.budgets.update(editing.id, { categoryId, amount: amt });
    } else {
      const existing = await db.budgets.where("categoryId").equals(categoryId === null ? 0 : categoryId).toArray();
      void existing;
      const all = await db.budgets.toArray();
      const dup = all.find((b) => (b.categoryId ?? null) === categoryId);
      if (dup) {
        await db.budgets.update(dup.id!, { amount: amt });
      } else {
        await db.budgets.add({ categoryId, amount: amt });
      }
    }
    toast.success("Budget saved");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="rounded-3xl max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit budget" : "New budget"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-bold text-muted-foreground mb-1 block">Scope</label>
            <Select value={catId} onValueChange={setCatId}>
              <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="overall">Overall monthly budget</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[11px] font-bold text-muted-foreground mb-1 block">Amount per month (AED)</label>
            <Input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 3000" className="h-11 rounded-xl" />
          </div>
          <button onClick={save} className="press w-full h-11 rounded-xl hero-grad text-white font-bold">
            {editing ? "Update budget" : "Save budget"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
