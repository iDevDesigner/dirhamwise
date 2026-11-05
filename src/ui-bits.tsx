"use client";

import { iconFor, ICONS, CircleEllipsisFallback } from "@/lib/icons";
import { currencySymbol } from "@/lib/format";
import type { Account, Category, Txn } from "@/lib/models";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import React from "react";

// ─── Page frame: sticky header + scrollable padded content ──────────────────

export function PageFrame({
  title,
  subtitle,
  onBack,
  actions,
  children,
  bare,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  actions?: React.ReactNode;
  children: React.ReactNode;
  bare?: boolean;
}) {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <header className="safe-top sticky top-0 z-30 bg-background/85 backdrop-blur-md border-b border-border/60">
        <div className="mx-auto w-full max-w-lg px-1 sm:px-0">
          <div className="flex items-center gap-1 px-3 h-14">
            {onBack && (
              <button
                onClick={onBack}
                className="press w-10 h-10 rounded-full flex items-center justify-center hover:bg-accent"
                aria-label="Go back"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}
            <div className="flex-1 min-w-0 pl-1">
              <h1 className="text-lg font-bold truncate leading-tight">{title}</h1>
              {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
            </div>
            {actions}
          </div>
        </div>
      </header>
      <div className={cn("flex-1 min-h-0", bare ? "" : "overflow-y-auto")}>
        <div className={cn("mx-auto w-full max-w-lg px-4 pt-3", bare ? "" : "pb-36")}>{children}</div>
      </div>
    </div>
  );
}

// ─── Category / account chip icons ──────────────────────────────────────────

export function CatIcon({
  category,
  size = "md",
}: {
  category?: Category | null;
  size?: "sm" | "md" | "lg";
}) {
  const Icon = ICONS[category?.icon ?? "CircleEllipsis"] ?? CircleEllipsisFallback;
  const dims = size === "lg" ? "w-12 h-12 rounded-2xl" : size === "sm" ? "w-8 h-8 rounded-lg" : "w-10 h-10 rounded-xl";
  const ic = size === "lg" ? "w-6 h-6" : size === "sm" ? "w-4 h-4" : "w-5 h-5";
  const color = category?.color ?? "#94a3b8";
  return (
    <div
      className={cn(dims, "flex items-center justify-center shrink-0")}
      style={{ backgroundColor: `${color}1f`, color }}
    >
      <Icon className={ic} />
    </div>
  );
}

export function AccIcon({ account, size = "sm" }: { account?: Account | null; size?: "sm" | "md" }) {
  const Icon = ICONS[account?.icon ?? "Wallet"] ?? CircleEllipsisFallback;
  const dims = size === "md" ? "w-10 h-10 rounded-xl" : "w-8 h-8 rounded-lg";
  const ic = size === "md" ? "w-5 h-5" : "w-4 h-4";
  const color = account ? accountColor(account.color) : "#94a3b8";
  return (
    <div className={cn(dims, "flex items-center justify-center shrink-0")} style={{ backgroundColor: `${color}1f`, color }}>
      <Icon className={ic} />
    </div>
  );
}

export const ACCOUNT_GRADIENTS: Record<string, { from: string; to: string; label: string }> = {
  emerald: { from: "#059669", to: "#0d9488", label: "Emerald" },
  teal: { from: "#0f766e", to: "#115e59", label: "Teal" },
  gold: { from: "#d97706", to: "#b45309", label: "Gold" },
  slate: { from: "#475569", to: "#334155", label: "Slate" },
  rose: { from: "#e11d48", to: "#be123c", label: "Rose" },
  violet: { from: "#7c3aed", to: "#6d28d9", label: "Violet" },
  sky: { from: "#0284c7", to: "#0369a1", label: "Sky" },
};

export function accountColor(key: string): string {
  return ACCOUNT_GRADIENTS[key]?.from ?? "#059669";
}

// ─── Transaction row ────────────────────────────────────────────────────────

export function TxnRow({
  txn,
  category,
  account,
  toAccount,
  baseCurrency,
  onClick,
  amountIn,
}: {
  txn: Txn;
  category?: Category | null;
  account?: Account | null;
  toAccount?: Account | null;
  baseCurrency: string;
  onClick?: () => void;
  amountIn?: "base" | "orig";
}) {
  const isTransfer = txn.type === "transfer";
  const income = txn.type === "income";
  const sign = income ? "+" : isTransfer ? "⇄" : "−";
  const color = income ? "text-income" : isTransfer ? "text-foreground" : "text-expense";
  const shown =
    amountIn === "orig" || txn.currency === baseCurrency
      ? `${txn.amount.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : `${(txn.amount).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const title = isTransfer ? `To ${toAccount?.name ?? "…"}` : (category?.name ?? (txn.note || "Transaction"));
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 py-2.5 text-left press rounded-xl px-1 hover:bg-accent/60"
    >
      <CatIcon category={category} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{title}</p>
        <p className="text-xs text-muted-foreground truncate">
          {isTransfer
            ? `${account?.name ?? ""} → ${toAccount?.name ?? ""}`
            : [account?.name, txn.note].filter(Boolean).join(" · ")}
          {txn.vat ? " · VAT" : ""}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className={cn("text-sm font-bold tnum", color)}>
          {sign} {shown} {currencySymbol(txn.currency)}
        </p>
      </div>
    </button>
  );
}

// ─── Empty state ────────────────────────────────────────────────────────────

export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6 gap-2">
      <div className="w-16 h-16 rounded-3xl bg-accent flex items-center justify-center text-primary mb-1">
        {icon}
      </div>
      <p className="font-bold">{title}</p>
      {hint && <p className="text-sm text-muted-foreground max-w-xs">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

// ─── Progress ring ──────────────────────────────────────────────────────────

export function ProgressRing({
  pct,
  size = 84,
  stroke = 9,
  color = "#059669",
  children,
}: {
  pct: number;
  size?: number;
  stroke?: number;
  color?: string;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-foreground/8" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (clamped / 100) * c}
          style={{ transition: "stroke-dashoffset .5s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

// ─── Card ───────────────────────────────────────────────────────────────────

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-3xl bg-card border border-border/70 shadow-sm", className)}>
      {children}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-2 mt-5 first:mt-1">
      <h2 className="text-[13px] font-bold uppercase tracking-wider text-muted-foreground">{children}</h2>
      {action}
    </div>
  );
}