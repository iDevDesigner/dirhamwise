"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useUI } from "@/lib/store";
import { db, getSettings } from "@/lib/db";
import type { Category, Frequency, Txn } from "@/lib/models";
import { evalExpr } from "./amount-pad";
import AmountPad from "./amount-pad";
import CategoryPicker from "./category-picker";
import { AccIcon } from "./ui-bits";
import { currencySymbol, round2, todayStr, vatSplit } from "@/lib/format";
import { FREQ_LABEL } from "@/lib/recurring";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Trash2,
  Repeat,
  Percent,
  ChevronDown,
  Check,
} from "lucide-react";
import { format, addDays, addMonths, addYears } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type Tab = "expense" | "income" | "transfer";

function nextOccurrence(date: string, freq: Frequency): string {
  const d = new Date(date + "T12:00:00");
  let nd: Date;
  switch (freq) {
    case "daily": nd = addDays(d, 1); break;
    case "weekly": nd = addDays(d, 7); break;
    case "biweekly": nd = addDays(d, 14); break;
    case "monthly": nd = addMonths(d, 1); break;
    case "quarterly": nd = addMonths(d, 3); break;
    case "yearly": nd = addYears(d, 1); break;
    default: nd = addMonths(d, 1);
  }
  return format(nd, "yyyy-MM-dd");
}

export default function AddSheet() {
  const { addOpen, addType, editing, prefillDate, closeAdd } = useUI();
  return (
    <Drawer open={addOpen} onOpenChange={(open) => { if (!open) closeAdd(); }} modal>
      <DrawerContent className="h-[94dvh] rounded-t-3xl data-[vaul-drawer-direction=bottom]:max-h-[94dvh] sm:mx-auto sm:w-full sm:max-w-lg">
        <VisuallyHiddenTitle />
        {addOpen && (
          <AddForm key={editing ? `edit-${editing.id}` : `new-${addType}-${prefillDate ?? ""}`} tab={editing ? editing.type : addType} editing={editing} prefillDate={prefillDate} />
        )}
      </DrawerContent>
    </Drawer>
  );
}

function VisuallyHiddenTitle() {
  return (
    <DrawerHeader className="sr-only">
      <DrawerTitle>Add transaction</DrawerTitle>
    </DrawerHeader>
  );
}

function AddForm({
  tab: initialTab,
  editing,
  prefillDate,
}: {
  tab: Tab;
  editing: Txn | null;
  prefillDate: string | null;
}) {
  const { closeAdd } = useUI();
  const settings = useSettingsSafe();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [expr, setExpr] = useState(editing ? String(editing.amount) : "");
  const [categoryId, setCategoryId] = useState<number | null>(editing?.categoryId ?? null);
  const [accountId, setAccountId] = useState<number | null>(editing?.accountId ?? null);
  const [toAccountId, setToAccountId] = useState<number | null>(editing?.toAccountId ?? null);
  const [date, setDate] = useState(editing?.date ?? prefillDate ?? todayStr());
  const [note, setNote] = useState(editing?.note ?? "");
  const [vat, setVat] = useState<"0" | "1">((editing?.vat ?? 0) ? "1" : "0");
  const [repeat, setRepeat] = useState(false);
  const [freq, setFreq] = useState<Frequency>("monthly");
  const [autoPost, setAutoPost] = useState(true);
  const [saving, setSaving] = useState(false);

  const accounts = useAccountsSafe();
  const amount = useMemo(() => evalExpr(expr) ?? (expr === "" ? 0 : null), [expr]);

  // default accounts: first cash for expense/income, else first two accounts
  useEffect(() => {
    if (accounts.length === 0) return;
    if (accountId === null) setAccountId(accounts[0]?.id ?? null);
    if (toAccountId === null) setToAccountId(accounts[1]?.id ?? accounts[0]?.id ?? null);
  }, [accounts.length]);

  const account = accounts.find((a) => a.id === accountId) ?? null;
  const toAccount = accounts.find((a) => a.id === toAccountId) ?? null;
  const currency = account?.currency ?? settings?.baseCurrency ?? "AED";
  const amt = amount ?? 0;
  const vatInfo = vat === "1" ? vatSplit(amt, settings?.vatRate ?? 5) : null;

  const save = useCallback(
    async (another: boolean) => {
      if (!accountId) {
        toast.error("Pick an account");
        return;
      }
      if (amount === null || amount <= 0) {
        toast.error("Enter an amount");
        return;
      }
      if (tab !== "transfer" && !categoryId) {
        toast.error("Pick a category");
        return;
      }
      if (tab === "transfer" && (!toAccountId || toAccountId === accountId)) {
        toast.error("Transfer needs two different accounts");
        return;
      }
      setSaving(true);
      try {
        const now = new Date().toISOString();
        const payload = {
          type: tab,
          amount: round2(amount),
          currency,
          categoryId: tab === "transfer" ? null : categoryId,
          accountId,
          toAccountId: tab === "transfer" ? toAccountId : null,
          date,
          note: note.trim(),
          vat: (vat === "1" ? 1 : 0) as 0 | 1,
          vatRate: settings?.vatRate ?? 5,
          updatedAt: now,
        };
        if (editing?.id) {
          await db.txns.update(editing.id, { ...payload, recurringId: editing.recurringId, createdAt: editing.createdAt });
          toast.success("Transaction updated");
        } else {
          await db.txns.add({ ...payload, recurringId: null, createdAt: now });
          if (repeat) {
            await db.recurrings.add({
              type: tab,
              amount: round2(amount),
              currency,
              categoryId: tab === "transfer" ? null : categoryId,
              accountId,
              toAccountId: tab === "transfer" ? toAccountId : null,
              note: note.trim() || "Recurring",
              vat: (vat === "1" ? 1 : 0) as 0 | 1,
              vatRate: settings?.vatRate ?? 5,
              frequency: freq,
              nextDate: nextOccurrence(date, freq),
              endDate: null,
              autoPost: autoPost ? 1 : 0,
              active: 1,
              lastPosted: null,
              createdAt: now,
            });
          }
          if (navigator.vibrate) navigator.vibrate(15);
          toast.success(repeat ? "Saved + scheduled to repeat" : "Transaction saved");
        }
        if (!another) closeAdd();
        else {
          setExpr("");
          setCategoryId(null);
          setNote("");
        }
      } finally {
        setSaving(false);
      }
    },
    [accountId, amount, categoryId, tab, toAccountId, currency, date, note, vat, repeat, freq, autoPost, editing, closeAdd, settings]
  );

  const del = async () => {
    if (!editing?.id) return;
    await db.txns.delete(editing.id);
    toast("Transaction deleted");
    closeAdd();
  };

  const tabs: { key: Tab; label: string; icon: typeof ArrowUpRight; cls: string }[] = [
    { key: "expense", label: "Expense", icon: ArrowUpRight, cls: "text-expense" },
    { key: "income", label: "Income", icon: ArrowDownLeft, cls: "text-income" },
    { key: "transfer", label: "Transfer", icon: ArrowLeftRight, cls: "text-foreground" },
  ];

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Tabs */}
      <div className="px-4 pt-1">
        <div className="grid grid-cols-3 gap-1.5">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "flex items-center justify-center gap-1.5 h-10 rounded-xl text-sm font-bold press",
                  active ? "bg-accent ring-1 ring-primary/40" : "text-muted-foreground hover:bg-muted/60"
                )}
              >
                <Icon className={cn("w-4 h-4", active && t.cls)} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Amount display */}
      <div className="px-4 pt-3">
        <div className="rounded-2xl bg-muted/60 border border-border/60 px-4 py-3">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {editing ? "Editing" : "Amount"}
            </span>
            <span className="text-xs font-bold text-muted-foreground">{currencySymbol(currency)}</span>
          </div>
          <div className="flex items-center justify-end gap-1 min-h-10">
            <span className={cn("text-3xl font-extrabold tnum text-right break-all", amt > 0 ? "" : "text-muted-foreground/50")}>
              {expr === "" ? "0" : expr}
            </span>
          </div>
          {vatInfo && amt > 0 && (
            <p className="text-[11px] text-muted-foreground text-right tnum">
              incl. VAT ({settings?.vatRate ?? 5}%): {vatInfo.vat.toFixed(2)} · base {vatInfo.base.toFixed(2)}
            </p>
          )}
          {expr && evalExpr(expr) !== null && /[+\-−×÷]/.test(expr) && (
            <p className="text-[11px] text-primary text-right tnum">= {evalExpr(expr)!.toFixed(2)}</p>
          )}
        </div>
      </div>

      {/* Scrollable middle — amount pad first so it is always in reach */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pt-3 space-y-3">
        <AmountPad expr={expr} onChange={setExpr} />

        {tab !== "transfer" && (
          <CategoryPicker type={tab} valueId={categoryId} onPick={(c) => setCategoryId(c?.id ?? null)} />
        )}

        {tab === "transfer" ? (
          <div className="space-y-2">
            <AccountSelect label="From" accounts={accounts} value={accountId} onChange={(v) => setAccountId(v)} />
            <AccountSelect label="To" accounts={accounts} value={toAccountId} onChange={(v) => setToAccountId(v)} />
          </div>
        ) : (
          <AccountSelect label="Account" accounts={accounts} value={accountId} onChange={(v) => setAccountId(v)} />
        )}

        {/* Date + VAT + repeat row — stacks on narrow phones to avoid overlap */}
        <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Date</label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value || todayStr())} className="h-10 rounded-xl" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">VAT {settings?.vatRate ?? 5}% (UAE)</label>
            <button
              type="button"
              onClick={() => setVat(vat === "1" ? "0" : "1")}
              className={cn(
                "w-full h-10 rounded-xl border px-3 flex items-center gap-2 text-sm font-semibold press",
                vat === "1" ? "border-gold bg-gold/10 text-foreground" : "border-border/60 text-muted-foreground"
              )}
            >
              <Percent className="w-4 h-4" />
              {vat === "1" ? "VAT included" : "No VAT"}
            </button>
          </div>
        </div>

        <Input
          placeholder="Note (e.g. Carrefour run, DEWA bill…)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="h-10 rounded-xl"
          maxLength={80}
        />

        {/* Repeat */}
        {!editing && (
          <div className="rounded-2xl border border-border/60 p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Repeat className="w-4 h-4 text-primary" /> Repeat automatically
              </div>
              <Switch checked={repeat} onCheckedChange={setRepeat} />
            </div>
            {repeat && (
              <div className="space-y-2">
                <Select value={freq} onValueChange={(v) => setFreq(v as Frequency)}>
                  <SelectTrigger className="h-9 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(FREQ_LABEL) as Frequency[]).map((f) => (
                      <SelectItem key={f} value={f}>{FREQ_LABEL[f]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Post automatically when due</span>
                  <Switch checked={autoPost} onCheckedChange={setAutoPost} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 border-t border-border/60 bg-card">
        <div className="flex gap-2 pt-2">
          {editing && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button className="press h-12 w-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center" aria-label="Delete transaction">
                  <Trash2 className="w-5 h-5" />
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this transaction?</AlertDialogTitle>
                  <AlertDialogDescription>This cannot be undone. Balances update immediately.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={del} className="bg-destructive text-white hover:bg-destructive/90">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <button
            onClick={() => save(false)}
            disabled={saving}
            className="press flex-1 h-12 rounded-2xl hero-grad text-white font-bold disabled:opacity-60"
          >
            {editing ? "Update" : "Save"}
          </button>
          {!editing && (
            <button
              onClick={() => save(true)}
              disabled={saving}
              className="press h-12 px-4 rounded-2xl bg-accent text-accent-foreground font-bold text-sm disabled:opacity-60"
            >
              Save&nbsp;+&nbsp;New
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function AccountSelect({
  label,
  accounts,
  value,
  onChange,
}: {
  label: string;
  accounts: { id?: number; name: string; color: string; icon: string; currency: string }[];
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = accounts.find((a) => a.id === value);
  return (
    <div className="relative">
      <label className="text-xs font-semibold text-muted-foreground mb-1 block">{label}</label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          className={cn(
            "w-full h-10 rounded-xl border border-border/60 px-2 flex items-center gap-2 text-sm font-semibold press",
            open && "ring-1 ring-primary/40"
          )}
        >
          {current ? (
            <>
              <AccIcon account={current as never} />
              <span className="flex-1 text-left truncate">{current.name}</span>
              <span className="text-[11px] text-muted-foreground">{current.currency}</span>
            </>
          ) : (
            <span className="flex-1 text-left text-muted-foreground">Select account…</span>
          )}
          <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", open && "rotate-180")} />
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[var(--radix-popover-trigger-width)] max-h-64 overflow-y-auto rounded-2xl border border-border bg-popover shadow-lg p-1.5 space-y-0.5"
        >
          {accounts.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => {
                onChange(a.id!);
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 rounded-xl px-2 py-2 text-sm font-medium hover:bg-accent press text-left"
            >
              <AccIcon account={a as never} size="sm" />
              <span className="flex-1 truncate">{a.name}</span>
              {value === a.id && <Check className="w-4 h-4 text-primary" />}
            </button>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  );
}

// small local hooks to avoid circular imports

function useAccountsSafe() {
  const data = useLiveQuery(() => db.accounts.filter((a) => !a.archived).toArray(), []);
  return data ?? [];
}

function useSettingsSafe() {
  const [settings, setSettings] = useState<Awaited<ReturnType<typeof getSettings>> | null>(null);
  useEffect(() => {
    getSettings().then(setSettings);
  }, []);
  return settings;
}
