"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db, getSettings, DEFAULT_RATES } from "./db";
import {
  type Account,
  type AppSettings,
  type Bill,
  type Budget,
  type Category,
  type Goal,
  type Recurring,
  type Remittance,
  type Txn,
} from "./models";
import { monthRange, monthsBack, round2, todayStr } from "./format";

export interface TxnRefs {
  accounts: Account[];
  categories: Category[];
  txns: Txn[];
  settings: AppSettings;
}

/** Central live data hook: everything the app needs, re-rendered on any change. */
export function useData(): {
  data: TxnRefs | undefined;
  ready: boolean;
} {
  const raw = useLiveQuery(async () => {
    const [accounts, categories, txns, settings] = await Promise.all([
      db.accounts.toArray(),
      db.categories.toArray(),
      db.txns.toArray(),
      getSettings(),
    ]);
    return { accounts, categories, txns, settings };
  }, []);
  return { data: raw, ready: !!raw };
}

export function useSettings(): AppSettings | undefined {
  return useLiveQuery(() => getSettings(), []);
}

export function useBudgets(): Budget[] | undefined {
  return useLiveQuery(() => db.budgets.toArray(), []);
}

export function useGoals(): Goal[] | undefined {
  return useLiveQuery(() => db.goals.toArray(), []);
}

export function useBills(): Bill[] | undefined {
  return useLiveQuery(() => db.bills.orderBy("nextDue").toArray(), []);
}

export function useRemittances(): Remittance[] | undefined {
  return useLiveQuery(() => db.remittances.orderBy("date").reverse().toArray(), []);
}

export function useRecurrings(): Recurring[] | undefined {
  return useLiveQuery(() => db.recurrings.orderBy("nextDate").toArray(), []);
}

// ─── Conversion ──────────────────────────────────────────────────────────────

export function rateOf(settings: AppSettings | undefined, currency: string): number {
  if (!settings) return 1;
  if (currency === settings.baseCurrency) return 1;
  return settings.rates[currency] ?? DEFAULT_RATES[currency] ?? 1;
}

export function toBase(amount: number, currency: string, settings: AppSettings | undefined): number {
  return round2(amount * rateOf(settings, currency));
}

/** rate multiplier to convert from currency A to currency B */
export function crossRate(settings: AppSettings | undefined, from: string, to: string): number {
  const rFrom = rateOf(settings, from);
  const rTo = rateOf(settings, to);
  if (rTo === 0) return 1;
  return rFrom / rTo;
}

// ─── Balances ────────────────────────────────────────────────────────────────

export function computeBalances(
  accounts: Account[],
  txns: Txn[],
  settings: AppSettings | undefined
): Record<number, { balance: number; balanceBase: number }> {
  const out: Record<number, { balance: number; balanceBase: number }> = {};
  for (const a of accounts) out[a.id!] = { balance: a.initial, balanceBase: 0 };
  for (const t of txns) {
    if (t.type === "expense") {
      if (out[t.accountId]) out[t.accountId].balance -= t.amount;
    } else if (t.type === "income") {
      if (out[t.accountId]) out[t.accountId].balance += t.amount;
    } else if (t.type === "transfer") {
      if (out[t.accountId]) out[t.accountId].balance -= t.amount;
      if (t.toAccountId && out[t.toAccountId]) {
        const converted = t.amount * crossRate(settings, t.currency, accounts.find((a) => a.id === t.toAccountId)?.currency ?? settings?.baseCurrency ?? "AED");
        out[t.toAccountId].balance += converted;
      }
    }
  }
  for (const a of accounts) {
    out[a.id!].balance = round2(out[a.id!].balance);
    out[a.id!].balanceBase = round2(out[a.id!].balance * rateOf(settings, a.currency));
  }
  return out;
}

export function netWorthOf(
  accounts: Account[],
  balances: Record<number, { balanceBase: number }>
): number {
  return round2(
    accounts
      .filter((a) => a.includeInNet && !a.archived)
      .reduce((s, a) => s + (balances[a.id!]?.balanceBase ?? 0), 0)
  );
}

// ─── Month aggregates ────────────────────────────────────────────────────────

export interface MonthTotals {
  income: number;
  expense: number;
  vatTotal: number;
  byCategory: { categoryId: number; total: number }[];
  byDay: Record<string, { income: number; expense: number }>;
}

export function totalsForRange(
  txns: Txn[],
  settings: AppSettings | undefined,
  start: string,
  end: string
): MonthTotals {
  let income = 0;
  let expense = 0;
  let vatTotal = 0;
  const byCat = new Map<number, number>();
  const byDay: Record<string, { income: number; expense: number }> = {};
  for (const t of txns) {
    if (t.date < start || t.date > end) continue;
    const amt = toBase(t.amount, t.currency, settings);
    if (t.type === "income") {
      income += amt;
      const d = (byDay[t.date] ??= { income: 0, expense: 0 });
      d.income += amt;
    } else if (t.type === "expense") {
      expense += amt;
      if (t.vat) vatTotal += round2(amt - amt / (1 + t.vatRate / 100));
      const d = (byDay[t.date] ??= { income: 0, expense: 0 });
      d.expense += amt;
      if (t.categoryId != null) byCat.set(t.categoryId, (byCat.get(t.categoryId) ?? 0) + amt);
    }
  }
  return {
    income: round2(income),
    expense: round2(expense),
    vatTotal: round2(vatTotal),
    byCategory: [...byCat.entries()]
      .map(([categoryId, total]) => ({ categoryId, total: round2(total) }))
      .sort((a, b) => b.total - a.total),
    byDay,
  };
}

export function useMonthTotals(month: string): MonthTotals | undefined {
  return useLiveQuery(async () => {
    const { txns, settings } = await snapshot();
    const { start, end } = monthRange(month);
    return totalsForRange(txns, settings, start, end);
  }, [month]);
}

export function useRecentMonthsTotals(count: number) {
  return useLiveQuery(async () => {
    const { txns, settings } = await snapshot();
    const months = monthsBack(count);
    return months.map((m) => {
      const { start, end } = monthRange(m);
      const t = totalsForRange(txns, settings, start, end);
      return { month: m, income: t.income, expense: t.expense };
    });
  }, [count]);
}

async function snapshot(): Promise<{ txns: Txn[]; settings: AppSettings }> {
  const [txns, settings] = await Promise.all([db.txns.toArray(), getSettings()]);
  return { txns, settings };
}

// ─── Budget progress ─────────────────────────────────────────────────────────

export interface BudgetProgress {
  budget: Budget;
  spent: number;
  pct: number;
  left: number;
}

export function budgetProgressFor(
  budgets: Budget[],
  totals: MonthTotals | undefined,
  categories: Category[]
): { overall: BudgetProgress | null; perCategory: BudgetProgress[] } {
  const overallBudget = budgets.find((b) => b.categoryId === null);
  const expense = totals?.expense ?? 0;
  const overall: BudgetProgress | null = overallBudget
    ? {
        budget: overallBudget,
        spent: expense,
        pct: overallBudget.amount > 0 ? Math.min(100, Math.round((expense / overallBudget.amount) * 100)) : 0,
        left: round2(overallBudget.amount - expense),
      }
    : null;
  const perCategory = budgets
    .filter((b) => b.categoryId !== null)
    .map((b) => {
      const spent = totals?.byCategory.find((c) => c.categoryId === b.categoryId)?.total ?? 0;
      return {
        budget: b,
        spent,
        pct: b.amount > 0 ? Math.min(100, Math.round((spent / b.amount) * 100)) : 0,
        left: round2(b.amount - spent),
      };
    })
    .sort((a, b) => b.pct - a.pct);
  void categories;
  return { overall, perCategory };
}

// ─── Upcoming ────────────────────────────────────────────────────────────────

export function useUpcoming(): { bills: Bill[]; recurrings: Recurring[] } | undefined {
  return useLiveQuery(async () => {
    const today = todayStr();
    const bills = (await db.bills.where("active").equals(1).sortBy("nextDue")).filter((b) => b.nextDue >= today).slice(0, 5);
    const recurrings = (await db.recurrings.where("active").equals(1).sortBy("nextDate")).filter((r) => r.nextDate >= today).slice(0, 5);
    return { bills, recurrings };
  }, []);
}
