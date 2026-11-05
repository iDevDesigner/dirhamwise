"use client";

import { useUI } from "@/lib/store";
import { useData, useBudgets, useRemittances, useBills, useGoals, useRecurrings } from "@/lib/queries";
import { useCloud } from "@/lib/cloud";
import { timeAgo } from "@/lib/live-rate";
import { PageFrame, Card } from "../ui-bits";
import {
  Bell,
  ChevronRight,
  Cloud,
  Eye,
  Landmark,
  LayoutList,
  Lock,
  Repeat,
  Send,
  Settings,
  Shapes,
  Target,
  Wallet,
} from "lucide-react";
import { toBase } from "@/lib/queries";
import { round2 } from "@/lib/format";

export default function MoreView({ setLocked }: { setLocked: (v: boolean) => void }) {
  const setView = useUI((s) => s.setView);
  const { data } = useData();
  const budgets = useBudgets();
  const remittances = useRemittances();
  const bills = useBills();
  const goals = useGoals();
  const recurrings = useRecurrings();
  const { user, lastSync, status } = useCloud();

  const counts = {
    budgets: budgets?.length ?? 0,
    remittances: remittances?.length ?? 0,
    bills: (bills ?? []).filter((b) => b.active).length,
    goals: goals?.length ?? 0,
    recurrings: (recurrings ?? []).filter((r) => r.active).length,
  };
  void setLocked;

  const remTotal = data
    ? round2((remittances ?? []).reduce((s, r) => s + toBase(r.amount, r.currency, data.settings), 0))
    : 0;

  const items = [
    {
      key: "cloud" as const,
      icon: Cloud,
      label: "Account & Cloud Sync",
      sub: user
        ? status === "error"
          ? "Sync error — tap to review"
          : lastSync
            ? `Signed in · synced ${timeAgo(lastSync)}`
            : "Signed in · sync starting…"
        : "Sign in to back up across devices",
      color: "#0d9488",
    },
    { key: "transactions", icon: LayoutList, label: "All transactions", sub: "Search, filter, edit", color: "#0ea5e9" },
    { key: "accounts", icon: Landmark, label: "Accounts & wallets", sub: `${data?.accounts.filter((a) => !a.archived).length ?? 0} active`, color: "#059669" },
    { key: "budgets", icon: Target, label: "Budgets", sub: counts.budgets ? `${counts.budgets} set` : "Set your limits", color: "#e11d48" },
    { key: "goals", icon: Wallet, label: "Savings goals", sub: counts.goals ? `${counts.goals} goal${counts.goals > 1 ? "s" : ""}` : "Save with a plan", color: "#d97706" },
    { key: "remittance", icon: Send, label: "Home transfers", sub: counts.remittances ? `${remTotal.toLocaleString("en-AE")} sent` : "Track money home", color: "#7c3aed" },
    { key: "bills", icon: Bell, label: "Bills & subscriptions", sub: counts.bills ? `${counts.bills} active` : "Never miss a due date", color: "#0f766e" },
    { key: "recurrings", icon: Repeat, label: "Recurring rules", sub: counts.recurrings ? `${counts.recurrings} active` : "Automate repeats", color: "#475569" },
    { key: "categories", icon: Shapes, label: "Categories", sub: "Customise yours", color: "#be185d" },
    { key: "settings", icon: Settings, label: "Settings & data", sub: "Currency, VAT, backup, PIN", color: "#334155" },
  ] as const;

  return (
    <PageFrame title="More" subtitle="Everything in your money hub">
      {/* Glance mode promo */}
      <button onClick={() => setView("glance")} className="w-full press">
        <Card className="p-4 hero-grad text-white relative overflow-hidden text-left">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center">
              <Eye className="w-5.5 h-5.5" />
            </span>
            <div className="flex-1">
              <p className="font-bold text-sm">Money Glance mode</p>
              <p className="text-[11px] text-white/80">Big-type summary — perfect to pin on your home screen as a widget-style shortcut.</p>
            </div>
            <ChevronRight className="w-5 h-5 opacity-80" />
          </div>
        </Card>
      </button>

      <Card className="mt-4 divide-y divide-border/60 px-3 py-1">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <button key={it.key} onClick={() => setView(it.key)} className="w-full flex items-center gap-3 py-3.5 text-left press">
              <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${it.color}1c`, color: it.color }}>
                <Icon className="w-5 h-5" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-bold">{it.label}</span>
                <span className="block text-[11px] text-muted-foreground truncate">{it.sub}</span>
              </span>
              <ChevronRight className="w-4.5 h-4.5 text-muted-foreground/60" />
            </button>
          );
        })}
      </Card>

      <p className="text-center text-[10px] text-muted-foreground mt-5 flex items-center justify-center gap-1">
        <Lock className="w-3 h-3" /> Data stays on this device · optional Cloud Sync in Account
      </p>
      <p className="text-center text-[10px] text-muted-foreground mt-1">
        DirhamWise v1.1 · Made for UAE expats
      </p>
    </PageFrame>
  );
}
