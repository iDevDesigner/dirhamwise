"use client";

import { useState } from "react";
import { useUI } from "@/lib/store";
import { useBills, useData } from "@/lib/queries";
import { Card, CatIcon, EmptyState, PageFrame } from "../ui-bits";
import { currencySymbol, dateLabel, monthKey, todayStr } from "@/lib/format";
import { db } from "@/lib/db";
import { toast } from "sonner";
import { Plus, BellRing, Repeat, Check, Pencil, Trash2, PauseCircle, PlayCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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
import { format, addMonths, addYears } from "date-fns";
import type { Bill } from "@/lib/models";
import { CURRENCY_LIST } from "@/lib/db";

export default function BillsView() {
  const { data } = useData();
  const back = useUI((s) => s.back);
  const bills = useBills();
  const [editing, setEditing] = useState<Bill | null>(null);
  const [dlgOpen, setDlgOpen] = useState(false);

  if (!data) return <div className="min-h-dvh" />;
  const cur = data.settings.baseCurrency;
  const today = todayStr();
  const active = (bills ?? []).filter((b) => b.active);
  const paused = (bills ?? []).filter((b) => !b.active);
  const monthSpend = active.reduce((s, b) => s + (b.frequency === "monthly" ? b.amount : b.amount / 12), 0);

  const pay = async (b: Bill) => {
    const now = new Date().toISOString();
    await db.txns.add({
      type: "expense",
      amount: b.amount,
      currency: b.currency,
      categoryId: b.categoryId,
      accountId: b.accountId,
      toAccountId: null,
      date: today,
      note: b.name,
      vat: 0,
      vatRate: 5,
      recurringId: null,
      createdAt: now,
      updatedAt: now,
    });
    const next =
      b.frequency === "monthly"
        ? format(addMonths(new Date(b.nextDue + "T12:00:00"), 1), "yyyy-MM-dd")
        : format(addYears(new Date(b.nextDue + "T12:00:00"), 1), "yyyy-MM-dd");
    await db.bills.update(b.id!, { nextDue: next });
    toast.success(`${b.name} paid`, { description: `Next due ${dateLabel(next)}` });
  };

  return (
    <PageFrame
      title="Bills & subscriptions"
      subtitle={`${active.length} active · ≈ ${monthSpend.toLocaleString("en-AE")} ${cur}/mo`}
      onBack={back}
      actions={
        <button
          onClick={() => {
            setEditing(null);
            setDlgOpen(true);
          }}
          aria-label="Add bill"
          className="press w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mr-1"
        >
          <Plus className="w-5 h-5" />
        </button>
      }
    >
      {active.length === 0 && paused.length === 0 && (
        <EmptyState
          icon={<BellRing className="w-7 h-7" />}
          title="No bills tracked"
          hint="DEWA, du, Salik recharge, rent cheque, Netflix — add due dates and pay with one tap."
          action={
            <button onClick={() => setDlgOpen(true)} className="press h-10 px-5 rounded-xl hero-grad text-white text-sm font-bold">
              Add your first bill
            </button>
          }
        />
      )}

      {active.length > 0 && (
        <div className="space-y-2">
          {active.map((b) => {
            const cat = data.categories.find((c) => c.id === b.categoryId);
            const daysLeft = Math.round((new Date(b.nextDue + "T12:00:00").getTime() - new Date(today + "T12:00:00").getTime()) / 86400000);
            const dueSoon = daysLeft <= Math.max(2, b.remindDays);
            return (
              <Card key={b.id} className={cn("p-3.5", dueSoon && "ring-1 ring-gold/50 bg-gold/5")}>
                <div className="flex items-center gap-3">
                  <CatIcon category={cat ?? null} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-bold truncate">{b.name}</p>
                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{b.kind}</span>
                    </div>
                    <p className={cn("text-[11px] font-semibold", daysLeft < 0 ? "text-expense" : dueSoon ? "text-gold" : "text-muted-foreground")}>
                      {daysLeft < 0 ? `Overdue ${Math.abs(daysLeft)}d` : daysLeft === 0 ? "Due today" : `Due in ${daysLeft}d`} · {dateLabel(b.nextDue)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold tnum">{b.amount.toLocaleString("en-AE")} {currencySymbol(b.currency)}</p>
                    <p className="text-[10px] text-muted-foreground">{b.frequency}</p>
                  </div>
                </div>
                <div className="flex gap-2 mt-2.5">
                  <button onClick={() => pay(b)} className="press flex-1 h-9 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-1.5">
                    <Check className="w-4 h-4" /> Pay now
                  </button>
                  <button onClick={() => { setEditing(b); setDlgOpen(true); }} className="press h-9 px-3 rounded-xl bg-muted text-xs font-bold flex items-center gap-1">
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button
                    onClick={async () => {
                      await db.bills.update(b.id!, { active: 0 });
                      toast("Paused");
                    }}
                    aria-label="Pause"
                    className="press w-9 h-9 rounded-xl bg-muted flex items-center justify-center text-muted-foreground"
                  >
                    <PauseCircle className="w-4 h-4" />
                  </button>
                  <button
                    onClick={async () => {
                      await db.bills.delete(b.id!);
                      toast("Deleted");
                    }}
                    aria-label="Delete"
                    className="press w-9 h-9 rounded-xl bg-muted flex items-center justify-center text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {paused.length > 0 && (
        <>
          <p className="text-[13px] font-bold uppercase tracking-wider text-muted-foreground mt-5 mb-2">Paused</p>
          <div className="space-y-2">
            {paused.map((b) => (
              <Card key={b.id} className="p-3 flex items-center gap-3 opacity-70">
                <Repeat className="w-4 h-4 text-muted-foreground" />
                <p className="flex-1 text-sm font-semibold truncate">{b.name}</p>
                <button
                  onClick={async () => {
                    await db.bills.update(b.id!, { active: 1 });
                    toast("Resumed");
                  }}
                  aria-label="Resume"
                  className="press w-9 h-9 rounded-xl bg-muted flex items-center justify-center text-primary"
                >
                  <PlayCircle className="w-4 h-4" />
                </button>
                <button
                  onClick={async () => {
                    await db.bills.delete(b.id!);
                    toast("Deleted");
                  }}
                  aria-label="Delete"
                  className="press w-9 h-9 rounded-xl bg-muted flex items-center justify-center text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </Card>
            ))}
          </div>
        </>
      )}

      <BillDialog key={editing ? `e-${editing.id}` : "new"} open={dlgOpen} onClose={() => setDlgOpen(false)} editing={editing} accounts={data.accounts.filter((a) => !a.archived)} categories={data.categories.filter((c) => c.type === "expense" && c.parentId === null)} />
    </PageFrame>
  );
}

function BillDialog({
  open,
  onClose,
  editing,
  accounts,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  editing: Bill | null;
  accounts: { id?: number; name: string }[];
  categories: { id?: number; name: string }[];
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [amount, setAmount] = useState(String(editing?.amount ?? ""));
  const [currency, setCurrency] = useState(editing?.currency ?? "AED");
  const [kind, setKind] = useState<"bill" | "subscription">(editing?.kind ?? "bill");
  const [categoryId, setCategoryId] = useState<string>(editing?.categoryId ? String(editing.categoryId) : "none");
  const [accountId, setAccountId] = useState<string>(String(editing?.accountId ?? accounts[0]?.id ?? ""));
  const [frequency, setFrequency] = useState<"monthly" | "yearly">(editing?.frequency ?? "monthly");
  const [nextDue, setNextDue] = useState(editing?.nextDue ?? todayStr());
  const [remindDays, setRemind] = useState(String(editing?.remindDays ?? 3));

  const save = async () => {
    const amt = Number(amount);
    if (!name.trim() || !amt || !accountId) {
      toast.error("Name, amount and account are required");
      return;
    }
    const payload = {
      name: name.trim(),
      amount: amt,
      currency,
      kind,
      categoryId: categoryId === "none" ? null : Number(categoryId),
      accountId: Number(accountId),
      frequency,
      nextDue,
      remindDays: Number(remindDays) || 3,
      active: editing?.active ?? 1,
    };
    if (editing?.id) await db.bills.update(editing.id, payload);
    else await db.bills.add({ ...payload, createdAt: new Date().toISOString() });
    toast.success("Bill saved");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="rounded-3xl max-w-md max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit" : "New"} bill or subscription</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input placeholder="e.g. DEWA, du Home, Netflix, Rent cheque" value={name} onChange={(e) => setName(e.target.value)} className="h-11 rounded-xl" maxLength={40} />
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-1">
              <label className="text-[11px] font-bold text-muted-foreground mb-1 block">Kind</label>
              <Select value={kind} onValueChange={(v) => setKind(v as "bill" | "subscription")}>
                <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bill">Bill</SelectItem>
                  <SelectItem value="subscription">Subscription</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-muted-foreground mb-1 block">Amount</label>
              <Input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-10 rounded-xl" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-muted-foreground mb-1 block">Currency</label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>{CURRENCY_LIST.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-bold text-muted-foreground mb-1 block">Category</label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-muted-foreground mb-1 block">Pay from</label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[11px] font-bold text-muted-foreground mb-1 block">Frequency</label>
              <Select value={frequency} onValueChange={(v) => setFrequency(v as "monthly" | "yearly")}>
                <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-muted-foreground mb-1 block">Next due</label>
              <Input type="date" value={nextDue} onChange={(e) => setNextDue(e.target.value)} className="h-10 rounded-xl" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-muted-foreground mb-1 block">Remind</label>
              <Select value={remindDays} onValueChange={setRemind}>
                <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 5, 7].map((d) => (
                    <SelectItem key={d} value={String(d)}>{d}d before</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Repeat className="w-3.5 h-3.5" /> Reminders appear on Home &amp; Glance</span>
          </div>
          <button onClick={save} className="press w-full h-11 rounded-xl hero-grad text-white font-bold">
            {editing ? "Update" : "Add"}
          </button>
          <p className="text-[10px] text-muted-foreground text-center">Current month: {monthKey(todayStr())}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
