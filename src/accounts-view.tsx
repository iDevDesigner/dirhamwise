"use client";

import { useState } from "react";
import { useUI } from "@/lib/store";
import { computeBalances, netWorthOf, useData } from "@/lib/queries";
import { PageFrame, Card, EmptyState, ACCOUNT_GRADIENTS, AccIcon } from "../ui-bits";
import { db } from "@/lib/db";
import type { Account, AccountType } from "@/lib/models";
import { toast } from "sonner";
import { Landmark, Plus, Pencil, Wallet, CreditCard, PiggyBank, Coins, ArrowLeftRight, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
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
import { CURRENCY_LIST } from "@/lib/db";

const TYPE_ICON: Record<AccountType, typeof Wallet> = {
  cash: Coins,
  bank: Landmark,
  credit: CreditCard,
  savings: PiggyBank,
  wallet: Wallet,
};

export default function AccountsView() {
  const { data } = useData();
  const back = useUI((s) => s.back);
  const openAdd = useUI((s) => s.openAdd);
  const [editing, setEditing] = useState<Account | null>(null);
  const [dlgOpen, setDlgOpen] = useState(false);

  if (!data) return <div className="min-h-dvh" />;
  const cur = data.settings.baseCurrency;
  const balances = computeBalances(data.accounts, data.txns, data.settings);
  const net = netWorthOf(data.accounts, balances);
  const active = data.accounts.filter((a) => !a.archived);

  return (
    <PageFrame
      title="Accounts"
      subtitle={`Net worth ${net.toLocaleString("en-AE")} ${cur}`}
      onBack={back}
      actions={
        <button
          onClick={() => {
            setEditing(null);
            setDlgOpen(true);
          }}
          aria-label="Add account"
          className="press w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mr-1"
        >
          <Plus className="w-5 h-5" />
        </button>
      }
    >
      <div className="space-y-2.5">
        {active.length === 0 && <EmptyState icon={<Landmark className="w-7 h-7" />} title="No accounts" hint="Add your cash, bank, card or digital wallet to start." />}
        {active.map((a) => {
          const b = balances[a.id!];
          const grad = ACCOUNT_GRADIENTS[a.color] ?? ACCOUNT_GRADIENTS.emerald;
          return (
            <Card key={a.id} className="p-0 overflow-hidden">
              <div className="p-4 text-white relative" style={{ background: `linear-gradient(135deg, ${grad.from}, ${grad.to})` }}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
                      <AccIcon account={a} size="md" />
                    </span>
                    <div>
                      <p className="font-bold text-sm">{a.name}</p>
                      <p className="text-[11px] text-white/75 capitalize">{a.type} · {a.currency}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setEditing(a);
                      setDlgOpen(true);
                    }}
                    aria-label="Edit account"
                    className="press w-8 h-8 rounded-full bg-white/15 flex items-center justify-center"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-3xl font-extrabold tnum mt-3">{b.balance.toLocaleString("en-AE", { minimumFractionDigits: 2 })}</p>
                {a.currency !== cur && (
                  <p className="text-[11px] text-white/75 tnum">≈ {b.balanceBase.toLocaleString("en-AE")} {cur}</p>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <button onClick={() => openAdd("transfer")} className="press w-full h-12 mt-4 rounded-2xl bg-accent text-accent-foreground font-bold text-sm flex items-center justify-center gap-2">
        <ArrowLeftRight className="w-4.5 h-4.5" /> Move money between accounts
      </button>

      <p className="text-[11px] text-muted-foreground mt-3 px-1 leading-relaxed">
        Tip: exchange between currencies (e.g. AED → INR wallet) uses your rates from Settings. Credit cards count in net worth — turn that off per account if you prefer.
      </p>

      <AccountDialog key={editing ? `edit-${editing.id}` : "new"} open={dlgOpen} onClose={() => setDlgOpen(false)} editing={editing} />
    </PageFrame>
  );
}

function AccountDialog({ open, onClose, editing }: { open: boolean; onClose: () => void; editing: Account | null }) {
  const { data } = useData();
  const [name, setName] = useState(editing?.name ?? "");
  const [type, setType] = useState<AccountType>(editing?.type ?? "cash");
  const [currency, setCurrency] = useState(editing?.currency ?? "AED");
  const [initial, setInitial] = useState(String(editing?.initial ?? 0));
  const [color, setColor] = useState(editing?.color ?? "emerald");
  const [includeInNet, setIncludeInNet] = useState(editing ? editing.includeInNet === 1 : true);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) {
      toast.error("Give the account a name");
      return;
    }
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const payload = {
        name: name.trim(),
        type,
        currency,
        initial: Number(initial) || 0,
        color,
        icon: type === "credit" ? "CreditCard" : type === "savings" ? "PiggyBank" : type === "bank" ? "Landmark" : type === "wallet" ? "Wallet" : "Coins",
        includeInNet: (includeInNet ? 1 : 0) as 0 | 1,
        archived: editing?.archived ?? 0,
      };
      if (editing?.id) {
        await db.accounts.update(editing.id, payload);
        toast.success("Account updated");
      } else {
        await db.accounts.add({ ...payload, createdAt: now });
        toast.success("Account added");
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const del = async () => {
    if (!editing?.id || !data) return;
    const used = data.txns.some((t) => t.accountId === editing.id || t.toAccountId === editing.id);
    if (used) {
      toast.error("This account has transactions — delete or move them first");
      return;
    }
    await db.accounts.delete(editing.id);
    toast("Account deleted");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="rounded-3xl max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit account" : "New account"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Account name (e.g. ENBD Current, Cash)" value={name} onChange={(e) => setName(e.target.value)} className="h-11 rounded-xl" maxLength={30} />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-bold text-muted-foreground mb-1 block">Type</label>
              <Select value={type} onValueChange={(v) => setType(v as AccountType)}>
                <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank">Bank</SelectItem>
                  <SelectItem value="credit">Credit card</SelectItem>
                  <SelectItem value="savings">Savings</SelectItem>
                  <SelectItem value="wallet">Digital wallet</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-muted-foreground mb-1 block">Currency</label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCY_LIST.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-[11px] font-bold text-muted-foreground mb-1 block">Opening balance</label>
            <Input type="number" inputMode="decimal" value={initial} onChange={(e) => setInitial(e.target.value)} className="h-11 rounded-xl" />
          </div>
          <div>
            <label className="text-[11px] font-bold text-muted-foreground mb-1 block">Card colour</label>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(ACCOUNT_GRADIENTS).map(([k, g]) => (
                <button
                  key={k}
                  onClick={() => setColor(k)}
                  aria-label={g.label}
                  className={cn("w-9 h-9 rounded-xl press flex items-center justify-center", color === k && "ring-2 ring-offset-2 ring-foreground/60")}
                  style={{ background: `linear-gradient(135deg, ${g.from}, ${g.to})` }}
                >
                  {color === k && <Check className="w-4 h-4 text-white" />}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Include in net worth</span>
            <Switch checked={includeInNet} onCheckedChange={setIncludeInNet} />
          </div>
          <div className="flex gap-2 pt-1">
            {editing && (
              <button onClick={del} className="press h-11 px-4 rounded-xl bg-destructive/10 text-destructive text-sm font-bold">
                Delete
              </button>
            )}
            <button onClick={save} disabled={saving} className="press flex-1 h-11 rounded-xl hero-grad text-white font-bold disabled:opacity-60">
              {editing ? "Update" : "Add account"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
