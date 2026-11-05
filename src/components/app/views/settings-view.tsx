"use client";

import { useEffect, useState } from "react";
import { useUI } from "@/lib/store";
import { useData } from "@/lib/queries";
import { PageFrame, Card, SectionTitle } from "../ui-bits";
import { db, getSettings, setSetting, CURRENCY_LIST, DEFAULT_RATES } from "@/lib/db";
import type { AppSettings } from "@/lib/models";
import { hashPin } from "../lock-screen";
import { exportCSV, exportJSON, importJSON } from "@/lib/backup";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import { useLiveRate, timeAgo } from "@/lib/live-rate";
import { useCloud } from "@/lib/cloud";
import {
  Download,
  Upload,
  FileSpreadsheet,
  Lock,
  Moon,
  Sun,
  MonitorSmartphone,
  Percent,
  Wallet,
  Info,
  Trash2,
  ShieldCheck,
  RefreshCw,
  Radio,
  CloudCog,
} from "lucide-react";
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

export default function SettingsView() {
  const back = useUI((s) => s.back);
  const setView = useUI((s) => s.setView);
  const { data } = useData();
  const [settings, setLocal] = useState<AppSettings | null>(null);
  const [pinDlg, setPinDlg] = useState(false);
  const { theme, setTheme } = useTheme();
  const { data: rateData, refresh: refreshRate } = useLiveRate();
  const { user } = useCloud();

  useEffect(() => {
    getSettings().then(setLocal);
  }, []);

  const refresh = async () => setLocal(await getSettings());

  if (!settings || !data) return <div className="min-h-dvh" />;

  const update = async (patch: Partial<AppSettings>) => {
    for (const [k, v] of Object.entries(patch)) await setSetting(k, v);
    await refresh();
  };

  return (
    <PageFrame title="Settings" subtitle="Make it yours" onBack={back}>
      {/* Profile */}
      <SectionTitle>Profile</SectionTitle>
      <Card className="p-4 space-y-3">
        <div>
          <label className="text-[11px] font-bold text-muted-foreground mb-1 block">Your name</label>
          <Input
            defaultValue={settings.profileName}
            onBlur={(e) => update({ profileName: e.target.value.trim() })}
            placeholder="Name for greetings"
            className="h-10 rounded-xl"
            maxLength={30}
          />
        </div>
        <div>
          <label className="text-[11px] font-bold text-muted-foreground mb-1 block">Payday (day of month)</label>
          <Input
            type="number"
            min={1}
            max={31}
            defaultValue={settings.payday}
            onBlur={(e) => update({ payday: Math.min(31, Math.max(1, Number(e.target.value) || 28)) })}
            className="h-10 rounded-xl"
          />
        </div>
      </Card>

      {/* Live exchange rates */}
      <SectionTitle>Live exchange rates</SectionTitle>
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-primary" />
            <div>
              <p className="text-sm font-bold">Auto-update INR rate (live)</p>
              <p className="text-[11px] text-muted-foreground">
                {rateData
                  ? `1 AED = ₹${rateData.rate.toFixed(4)} · ${timeAgo(rateData.updatedAt)} · ${rateData.source}`
                  : "Live feed fills in on first load"}
              </p>
            </div>
          </div>
          <Switch checked={settings.autoInr} onCheckedChange={(v) => update({ autoInr: v })} />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refreshRate().then(() => toast.success("Rate refreshed"))}
            className="press h-9 px-3 rounded-xl bg-primary/10 text-primary text-xs font-bold flex items-center gap-1.5 shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh now
          </button>
          <p className="text-[10px] text-muted-foreground leading-snug">
            Free public feeds refresh daily; the app checks every 5 minutes. Manual rates below still apply to every other currency.
          </p>
        </div>
      </Card>

      {/* Currency & VAT */}
      <SectionTitle>Currency & VAT</SectionTitle>
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold">Base currency</p>
            <p className="text-[11px] text-muted-foreground">Everything is summarised in this currency</p>
          </div>
          <span className="text-sm font-extrabold px-3 py-1.5 rounded-xl bg-primary/10 text-primary">{settings.baseCurrency}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Percent className="w-4 h-4 text-gold" />
            <p className="text-sm font-bold">VAT rate (UAE standard: 5%)</p>
          </div>
          <Input
            type="number"
            min={0}
            max={50}
            step={0.5}
            defaultValue={settings.vatRate}
            onBlur={(e) => update({ vatRate: Number(e.target.value) || 0 })}
            className="h-9 w-20 rounded-xl text-center"
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-sm font-bold">Exchange rates → {settings.baseCurrency}</p>
            <button
              onClick={() => update({ rates: { ...DEFAULT_RATES } }).then(() => toast.success("Rates reset to defaults"))}
              className="press text-[11px] font-bold text-primary flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" /> Reset
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground mb-2">
            {settings.autoInr && settings.baseCurrency === "AED"
              ? "INR is auto-updated from the live feed. Others are snapshot values (pegged currencies exact) — edit to match your exchange house."
              : "Snapshot values (pegged currencies exact). Edit to match your exchange house."}
          </p>
          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
            {CURRENCY_LIST.filter((c) => c !== settings.baseCurrency).map((c) => (
              <div key={c} className="flex items-center gap-2">
                <span className="w-12 text-xs font-bold">{c}</span>
                <span className="text-[10px] text-muted-foreground">1 {c} =</span>
                <Input
                  type="number"
                  step="any"
                  defaultValue={settings.rates[c] ?? DEFAULT_RATES[c]}
                  onBlur={(e) => {
                    const v = Number(e.target.value);
                    if (v > 0) update({ rates: { ...settings.rates, [c]: v } });
                  }}
                  className="h-8 flex-1 rounded-lg text-xs tnum"
                />
                <span className="text-[10px] text-muted-foreground w-8">{settings.baseCurrency}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Security */}
      <SectionTitle>Security</SectionTitle>
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-primary" />
            <div>
              <p className="text-sm font-bold">App PIN lock</p>
              <p className="text-[11px] text-muted-foreground">Ask for a 4–6 digit PIN on launch</p>
            </div>
          </div>
          <Switch
            checked={settings.lockEnabled}
            onCheckedChange={(v) => {
              if (v) setPinDlg(true);
              else update({ lockEnabled: false, pinHash: "" });
            }}
          />
        </div>
        {settings.lockEnabled && (
          <button onClick={() => setPinDlg(true)} className="text-xs font-bold text-primary press">
            Change PIN
          </button>
        )}
      </Card>

      {/* Appearance */}
      <SectionTitle>Appearance</SectionTitle>
      <Card className="p-4">
        <div className="grid grid-cols-3 gap-2">
          {[
            { key: "light", label: "Light", icon: Sun },
            { key: "dark", label: "Dark", icon: Moon },
            { key: "system", label: "Auto", icon: MonitorSmartphone },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setTheme(t.key)}
                className={cn(
                  "flex flex-col items-center gap-1.5 py-3 rounded-2xl border press text-xs font-bold",
                  theme === t.key ? "border-primary bg-primary/5 text-primary" : "border-border/60 text-muted-foreground"
                )}
              >
                <Icon className="w-5 h-5" />
                {t.label}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Cloud sync shortcut */}
      <SectionTitle>Cloud backup</SectionTitle>
      <Card className="p-4">
        <button
          onClick={() => setView("cloud")}
          className="w-full flex items-center gap-3 text-left press"
        >
          <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <CloudCog className="w-4.5 h-4.5" />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-bold">{user ? "Manage cloud sync" : "Sign in for cloud backup"}</span>
            <span className="block text-[11px] text-muted-foreground">
              {user ? "Backup now, restore, or sign out" : "Free account · syncs across phones"}
            </span>
          </span>
        </button>
      </Card>

      {/* Data */}
      <SectionTitle>Data & backups</SectionTitle>
      <Card className="divide-y divide-border/60 px-3 py-1">
        <DataBtn
          icon={<FileSpreadsheet className="w-4.5 h-4.5" />}
          color="#059669"
          label="Export transactions (Excel/CSV)"
          sub="Open in Excel, Google Sheets or Numbers"
          onClick={() => exportCSV().then(() => toast.success("CSV downloaded"))}
        />
        <DataBtn
          icon={<Download className="w-4.5 h-4.5" />}
          color="#0d9488"
          label="Full backup (JSON)"
          sub="Everything: transactions, budgets, goals…"
          onClick={() => exportJSON().then(() => toast.success("Backup downloaded"))}
        />
        <RestoreRow onDone={refresh} />
        <ClearRow />
      </Card>

      {/* Widget help */}
      <SectionTitle>Home screen widget</SectionTitle>
      <Card className="p-4">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground leading-relaxed">
            <b className="text-foreground">Glance mode</b> gives you a big, instant summary screen. Add it next to your apps:
            long-press the DirhamWise icon → <b>Glance</b> shortcut (Android), or bookmark <b>?view=glance</b> via Add to Home Screen (iOS).
            True resizable widgets need a native app — PWAs can&apos;t ship those (yet).
          </div>
        </div>
      </Card>

      <Card className="p-4 mt-3">
        <div className="flex gap-3">
          <ShieldCheck className="w-5 h-5 text-income shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            <b className="text-foreground">Privacy:</b> DirhamWise stores everything in your browser&apos;s local database on this device — no accounts needed, no tracking. Optional Cloud Sync (Settings → Account) keeps a backup on your own server, so a lost phone never means lost data.
          </p>
        </div>
      </Card>

      <p className="text-center text-[10px] text-muted-foreground mt-5 mb-2">
        DirhamWise v1.1 · Built for UAE expats · Not financial advice
      </p>

      <PinDialog
        key={pinDlg ? "open" : "closed"}
        open={pinDlg}
        onClose={() => setPinDlg(false)}
        onSave={async (pin) => {
          await update({ pinHash: await hashPin(pin), lockEnabled: true });
          toast.success("PIN saved — the app will lock on next launch");
        }}
      />
    </PageFrame>
  );
}

function DataBtn({
  icon,
  color,
  label,
  sub,
  onClick,
}: {
  icon: React.ReactNode;
  color: string;
  label: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 py-3 text-left press">
      <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}1c`, color }}>
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-bold">{label}</span>
        <span className="block text-[11px] text-muted-foreground">{sub}</span>
      </span>
    </button>
  );
}

function RestoreRow({ onDone }: { onDone: () => void }) {
  const handleFile = async (file: File) => {
    try {
      const text = await file.text();
      await importJSON(text);
      toast.success("Backup restored");
      onDone();
    } catch (e) {
      toast.error("Restore failed — is this a DirhamWise backup file?");
    }
  };
  return (
    <label className="w-full flex items-center gap-3 py-3 text-left press cursor-pointer">
      <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "#7c3aed1c", color: "#7c3aed" }}>
        <Upload className="w-4.5 h-4.5" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-bold">Restore from backup</span>
        <span className="block text-[11px] text-muted-foreground">Replaces all current data</span>
      </span>
      <input
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
    </label>
  );
}

function ClearRow() {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button className="w-full flex items-center gap-3 py-3 text-left press">
          <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-destructive/10 text-destructive">
            <Trash2 className="w-4.5 h-4.5" />
          </span>
          <span className="flex-1">
            <span className="block text-sm font-bold text-destructive">Erase all data</span>
            <span className="block text-[11px] text-muted-foreground">Start fresh (export a backup first!)</span>
          </span>
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Erase everything?</AlertDialogTitle>
          <AlertDialogDescription>
            All transactions, accounts, budgets, goals and settings on this device will be permanently deleted.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep my data</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90"
            onClick={async () => {
              await Promise.all([
                db.txns.clear(),
                db.accounts.clear(),
                db.categories.clear(),
                db.budgets.clear(),
                db.goals.clear(),
                db.bills.clear(),
                db.remittances.clear(),
                db.recurrings.clear(),
                db.settings.clear(),
              ]);
              location.reload();
            }}
          >
            Erase everything
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function PinDialog({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (pin: string) => void }) {
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [step, setStep] = useState(0);
  // state resets on mount via key prop in parent

  const press = (k: string) => {
    if (k === "del") {
      if (step === 0) setPin((p) => p.slice(0, -1));
      else setConfirm((p) => p.slice(0, -1));
      return;
    }
    if (step === 0) {
      const next = (pin + k).slice(0, 6);
      setPin(next);
      if (next.length >= 4 && k !== "" && next.length === 6) setStep(1);
      else if (next.length >= 4 && digitCount(next) && next.length === 6) setStep(1);
    } else {
      const next = (confirm + k).slice(0, 6);
      setConfirm(next);
      if (next.length === pin.length && next.length >= 4) {
        if (next === pin) {
          onSave(pin);
          onClose();
        } else {
          toast.error("PINs don't match — try again");
          setPin("");
          setConfirm("");
          setStep(0);
        }
      }
    }
  };

  const digitCount = (s: string) => s.length >= 4;

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="rounded-3xl max-w-sm">
        <DialogHeader>
          <DialogTitle>{step === 0 ? "Set your PIN" : "Confirm PIN"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 pb-2">
          <div className="flex gap-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className={cn(
                  "w-3 h-3 rounded-full border-2",
                  (step === 0 ? pin : confirm).length > i ? "bg-primary border-primary" : "border-muted-foreground/40"
                )}
              />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((k) => (
              <button key={k} onClick={() => press(k)} className="press w-14 h-14 rounded-2xl bg-muted text-xl font-bold">
                {k}
              </button>
            ))}
            <button onClick={() => press("del")} className="press w-14 h-14 rounded-2xl bg-muted flex items-center justify-center" aria-label="Delete">
              ⌫
            </button>
            <button onClick={() => press("0")} className="press w-14 h-14 rounded-2xl bg-muted text-xl font-bold">
              0
            </button>
            {step === 0 && pin.length >= 4 ? (
              <button onClick={() => setStep(1)} className="press w-14 h-14 rounded-2xl hero-grad text-white font-bold">
                →
              </button>
            ) : (
              <div className="w-14 h-14" />
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">4–6 digits. Don&apos;t use your ATM PIN 😄</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
