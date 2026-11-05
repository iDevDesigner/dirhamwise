"use client";

import { useMemo, useState } from "react";
import { useUI } from "@/lib/store";
import { toBase, useData, useMonthTotals, useRemittances } from "@/lib/queries";
import { Card, EmptyState, PageFrame, SectionTitle } from "../ui-bits";
import { currencySymbol, dateLabel, monthKey, monthLabel, todayStr } from "@/lib/format";
import { db } from "@/lib/db";
import { exportRemittanceCSV } from "@/lib/backup";
import { toast } from "sonner";
import { Plus, Send, FileDown, Trash2 } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { CURRENCY_LIST } from "@/lib/db";
import { useLiveRate, timeAgo } from "@/lib/live-rate";
import { RateSpark } from "../widgets/rate-card";
import { cn } from "@/lib/utils";
import type { Remittance } from "@/lib/models";

const SERVICES = ["Al Ansari Exchange", "Lulu Exchange", "Wall Street Exchange", "Emirates NBD", "Mashreq", "Wise", "Western Union", "Bank transfer", "Other"];
const PURPOSES = ["Family support", "Savings at home", "Investment", "Property", "Education", "Debt repayment", "Other"];
const COUNTRIES = ["India", "Pakistan", "Philippines", "Egypt", "Bangladesh", "Sri Lanka", "Nepal", "United Kingdom", "Jordan", "Lebanon", "Sudan", "Kenya", "Nigeria", "Other"];

export default function RemittanceView() {
  const { data } = useData();
  const back = useUI((s) => s.back);
  const remittances = useRemittances();
  const totals = useMonthTotals(monthKey(new Date()));
  const [dlgOpen, setDlgOpen] = useState(false);
  const { data: rateData } = useLiveRate();

  const stats = useMemo(() => {
    if (!remittances || !data) return null;
    const year = String(new Date().getFullYear());
    const yr = remittances.filter((r) => r.date.startsWith(year));
    const total = yr.reduce((s, r) => s + toBase(r.amount, r.currency, data.settings), 0);
    const fees = yr.reduce((s, r) => s + toBase(r.fee, r.currency, data.settings), 0);
    const income = totals?.income ?? 0;
    const monthSent = remittances.filter((r) => r.date.startsWith(monthKey(new Date()))).reduce((s, r) => s + toBase(r.amount + r.fee, r.currency, data.settings), 0);
    return {
      count: yr.length,
      total,
      fees,
      pctOfIncome: income > 0 ? Math.round((monthSent / income) * 100) : null,
    };
  }, [remittances, data, totals]);

  const byMonth = useMemo(() => {
    const map = new Map<string, Remittance[]>();
    for (const r of remittances ?? []) {
      const arr = map.get(r.date.slice(0, 7)) ?? [];
      arr.push(r);
      map.set(r.date.slice(0, 7), arr);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [remittances]);

  if (!data) return <div className="min-h-dvh" />;
  const cur = data.settings.baseCurrency;
  const sym = currencySymbol(cur);

  return (
    <PageFrame
      title="Home transfers"
      subtitle="Your remittance register"
      onBack={back}
      actions={
        <div className="flex gap-1 mr-1">
          <button onClick={() => exportRemittanceCSV().then(() => toast.success("CSV downloaded"))} aria-label="Export CSV" className="press w-10 h-10 rounded-full hover:bg-accent flex items-center justify-center text-muted-foreground">
            <FileDown className="w-5 h-5" />
          </button>
          <button onClick={() => setDlgOpen(true)} aria-label="Add transfer" className="press w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <Plus className="w-5 h-5" />
          </button>
        </div>
      }
    >
      {/* Year stats */}
      <div className="hero-grad rounded-3xl p-5 text-white">
        <p className="text-white/75 text-xs font-semibold uppercase tracking-wider">{new Date().getFullYear()} · sent home</p>
        <div className="flex items-end gap-2 mt-1">
          <p className="text-4xl font-extrabold tnum">{(stats?.total ?? 0).toLocaleString("en-AE")}</p>
          <span className="text-white/80 font-bold mb-1">{cur}</span>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-4">
          <div className="rounded-2xl bg-white/10 px-3 py-2">
            <p className="text-[10px] text-white/70 font-bold uppercase">Transfers</p>
            <p className="text-lg font-bold tnum">{stats?.count ?? 0}</p>
          </div>
          <div className="rounded-2xl bg-white/10 px-3 py-2">
            <p className="text-[10px] text-white/70 font-bold uppercase">Fees paid</p>
            <p className="text-lg font-bold tnum">{(stats?.fees ?? 0).toLocaleString("en-AE")}</p>
          </div>
          <div className="rounded-2xl bg-white/10 px-3 py-2">
            <p className="text-[10px] text-white/70 font-bold uppercase">Of income</p>
            <p className="text-lg font-bold tnum">{stats?.pctOfIncome != null ? `${stats.pctOfIncome}%` : "—"}</p>
          </div>
        </div>
        {stats?.pctOfIncome != null && stats.pctOfIncome > 30 && (
          <p className="text-[11px] text-amber-200 mt-2.5 leading-snug">
            Above the 30% comfort line — common guidance is to keep remittances under 30% of income so you can still save in the UAE.
          </p>
        )}
      </div>

      {/* Live rate banner */}
      {rateData && (
        <Card className="p-4 mt-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Today&apos;s live rate · updated {timeAgo(rateData.updatedAt)}</p>
              <p className="text-2xl font-extrabold tnum mt-0.5">
                1 AED = ₹{rateData.rate.toFixed(2)}
                {rateData.changePct != null && (
                  <span className={cn("text-xs font-bold ml-2", rateData.changePct >= 0 ? "text-income" : "text-expense")}>
                    {rateData.changePct >= 0 ? "+" : ""}{rateData.changePct.toFixed(2)}%
                  </span>
                )}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5 tnum">
                30-day range: ₹{Math.min(...(rateData.history.slice(0, 30).map((h) => h.rate))).toFixed(2)} – ₹{Math.max(...(rateData.history.slice(0, 30).map((h) => h.rate))).toFixed(2)}
              </p>
            </div>
            <RateSpark points={(rateData.history.slice(0, 14).reverse())} stroke="#059669" width={96} height={40} />
          </div>
        </Card>
      )}

      {/* List */}
      <SectionTitle>History</SectionTitle>
      {byMonth.length === 0 ? (
        <EmptyState
          icon={<Send className="w-7 h-7" />}
          title="No transfers logged"
          hint="Track what you send home — amounts, fees, exchange services and purpose. Spot hidden fees over a year."
          action={
            <button onClick={() => setDlgOpen(true)} className="press h-10 px-5 rounded-xl hero-grad text-white text-sm font-bold">
              Log a transfer
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {byMonth.map(([m, items]) => (
            <div key={m}>
              <p className="text-xs font-bold text-muted-foreground px-1.5 mb-1">
                {monthLabel(m)} · {items.reduce((s, r) => s + toBase(r.amount, r.currency, data.settings), 0).toLocaleString("en-AE")} {sym}
              </p>
              <Card className="divide-y divide-border/60 px-3 py-1">
                {items.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 py-2.5">
                    <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Send className="w-4 h-4" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">
                        {r.purpose} <span className="text-muted-foreground font-normal">· {r.service}</span>
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {dateLabel(r.date)} · {r.country}
                        {r.fee > 0 ? ` · fee ${r.fee} ${r.currency}` : ""}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold tnum">{r.amount.toLocaleString("en-AE")} {currencySymbol(r.currency)}</p>
                      {r.currency !== cur && (
                        <p className="text-[10px] text-muted-foreground tnum">≈ {toBase(r.amount, r.currency, data.settings).toLocaleString("en-AE")} {cur}</p>
                      )}
                    </div>
                    <button
                      onClick={async () => {
                        await db.remittances.delete(r.id!);
                        toast("Transfer removed");
                      }}
                      aria-label="Delete"
                      className="press w-8 h-8 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive flex items-center justify-center"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </Card>
            </div>
          ))}
        </div>
      )}

      <RemittanceDialog
        open={dlgOpen}
        onClose={() => setDlgOpen(false)}
        accounts={data.accounts.filter((a) => !a.archived)}
        liveInrRate={rateData?.rate ?? null}
      />
    </PageFrame>
  );
}

function RemittanceDialog({
  open,
  onClose,
  accounts,
  liveInrRate,
}: {
  open: boolean;
  onClose: () => void;
  accounts: { id?: number; name: string; currency: string }[];
  liveInrRate: number | null;
}) {
  const [date, setDate] = useState(todayStr());
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("AED");
  const [fee, setFee] = useState("");
  const [rate, setRate] = useState("");
  const [service, setService] = useState(SERVICES[0]);
  const [purpose, setPurpose] = useState(PURPOSES[0]);
  const [country, setCountry] = useState(COUNTRIES[0]);
  const [note, setNote] = useState("");
  const [alsoExpense, setAlsoExpense] = useState(true);
  const [accountId, setAccountId] = useState<string>(String(accounts[0]?.id ?? ""));

  const save = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      toast.error("Enter the amount sent");
      return;
    }
    await db.remittances.add({
      date,
      amount: amt,
      currency,
      fee: Number(fee) || 0,
      rate: Number(rate) || null,
      service,
      purpose,
      country,
      note: note.trim(),
      createdAt: new Date().toISOString(),
    });
    if (alsoExpense && accountId) {
      const now = new Date().toISOString();
      await db.txns.add({
        type: "expense",
        amount: amt + (Number(fee) || 0),
        currency,
        categoryId: (await db.categories.where("name").equals("Family Support").first())?.id ?? null,
        accountId: Number(accountId),
        toAccountId: null,
        date,
        note: `Remittance · ${purpose} (${service})`,
        vat: 0,
        vatRate: 5,
        recurringId: null,
        createdAt: now,
        updatedAt: now,
      });
    }
    toast.success("Transfer logged" + (alsoExpense ? " + expense recorded" : ""));
    setAmount("");
    setFee("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="rounded-3xl max-w-md max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log a home transfer</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-bold text-muted-foreground mb-1 block">Date</label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10 rounded-xl" />
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
              <label className="text-[11px] font-bold text-muted-foreground mb-1 block">Amount sent</label>
              <Input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 1000" className="h-10 rounded-xl" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-muted-foreground mb-1 block">Fee</label>
              <Input type="number" inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} placeholder="0" className="h-10 rounded-xl" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-bold text-muted-foreground mb-1 block">Service</label>
              <Select value={service} onValueChange={setService}>
                <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>{SERVICES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-muted-foreground mb-1 block">Country</label>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>{COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-bold text-muted-foreground mb-1 block">Purpose</label>
              <Select value={purpose} onValueChange={setPurpose}>
                <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>{PURPOSES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-muted-foreground mb-1 block">Rate (opt.)</label>
              <div className="flex gap-1.5">
                <Input type="number" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="e.g. 24.1" className="h-10 rounded-xl flex-1" />
                {currency === "AED" && liveInrRate != null && (
                  <button
                    type="button"
                    onClick={() => {
                      setRate(liveInrRate.toFixed(4));
                      toast.success(`Live rate applied: ₹${liveInrRate.toFixed(4)} per AED`);
                    }}
                    className="press shrink-0 h-10 px-2.5 rounded-xl bg-primary/10 text-primary text-[10px] font-bold leading-tight"
                    title="Use today's live AED→INR rate"
                  >
                    Use live
                    <br />
                    ₹{liveInrRate.toFixed(2)}
                  </button>
                )}
              </div>
            </div>
          </div>
          <Input placeholder="Note (recipient, reference…)" value={note} onChange={(e) => setNote(e.target.value)} className="h-10 rounded-xl" maxLength={80} />
          <div className="rounded-2xl border border-border/60 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Also record as expense</span>
              <Switch checked={alsoExpense} onCheckedChange={setAlsoExpense} />
            </div>
            {alsoExpense && (
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="From account" /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>{a.name} ({a.currency})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <button onClick={save} className="press w-full h-11 rounded-xl hero-grad text-white font-bold">
            Save transfer
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
