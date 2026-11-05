import type { AppSettings, Bill, Category, Goal, Remittance, Txn } from "./models";
import { budgetProgressFor, toBase, type MonthTotals } from "./queries";
import { daysInMonth, monthLabel, round2, todayStr } from "./format";

// ─── Financial Health Score (0-100) ──────────────────────────────────────────
// Built for UAE expats: weighs savings rate, budget discipline, emergency
// buffer, remittance load and overall money hygiene.

export interface HealthResult {
  score: number; // 0-100
  band: "Excellent" | "Good" | "Fair" | "Needs Work";
  color: string;
  parts: { label: string; pts: number; max: number; hint: string }[];
}

export function healthScore(args: {
  totals: MonthTotals;
  lastMonthTotals?: MonthTotals;
  budgets: { categoryId: number | null; amount: number }[];
  accounts: { balanceBase: number }[];
  goals: Goal[];
  bills: Bill[];
  remittances: Remittance[];
  txns: Txn[];
  settings: AppSettings;
}): HealthResult {
  const { totals, lastMonthTotals, budgets, accounts, goals, bills, remittances, settings } = args;
  const parts: HealthResult["parts"] = [];

  // 1) Savings rate — 35 pts
  const income = totals.income;
  const saved = income - totals.expense;
  const savingsRate = income > 0 ? saved / income : 0;
  const savingsPts = income <= 0 ? 0 : Math.round(Math.max(0, Math.min(1, savingsRate / 0.25)) * 35);
  parts.push({
    label: "Savings rate",
    pts: savingsPts,
    max: 35,
    hint:
      income <= 0
        ? "Add your income to start tracking."
        : savingsRate >= 0.25
          ? `Great — you kept ${Math.round(savingsRate * 100)}% of income.`
          : `You kept ${Math.round(savingsRate * 100)}% of income. Aim for 25%+.`,
  });

  // 2) Budget discipline — 25 pts
  const { overall } = budgetProgressFor(
    budgets.map((b, i) => ({ id: i, categoryId: b.categoryId, amount: b.amount })),
    totals,
    []
  );
  let budgetPts = 0;
  let budgetHint = "Set a monthly budget to unlock these points.";
  if (overall) {
    if (overall.pct <= 85) {
      budgetPts = 25;
      budgetHint = `Only ${overall.pct}% of budget used.`;
    } else if (overall.pct <= 100) {
      budgetPts = 18;
      budgetHint = `Close to the limit (${overall.pct}%).`;
    } else {
      budgetPts = Math.max(0, 18 - Math.min(18, Math.round((overall.pct - 100) / 5)));
      budgetHint = `Over budget by ${Math.abs(overall.left).toLocaleString("en-AE")} ${settings.baseCurrency}.`;
    }
  }
  parts.push({ label: "Budget discipline", pts: budgetPts, max: 25, hint: budgetHint });

  // 3) Emergency buffer — 20 pts (3 months of avg expenses)
  const avgMonthly =
    lastMonthTotals && lastMonthTotals.expense > 0
      ? (totals.expense + lastMonthTotals.expense) / 2
      : totals.expense;
  const net = round2(accounts.reduce((s, a) => s + a.balanceBase, 0));
  const monthsCovered = avgMonthly > 0 ? net / avgMonthly : net > 0 ? 6 : 0;
  const bufferPts = Math.round(Math.max(0, Math.min(1, monthsCovered / 3)) * 20);
  parts.push({
    label: "Emergency buffer",
    pts: bufferPts,
    max: 20,
    hint:
      monthsCovered >= 3
        ? `Your balance covers ${monthsCovered.toFixed(1)} months of spending.`
        : `Balance covers ${monthsCovered.toFixed(1)} months. Target 3+ months.`,
  });

  // 4) Remittance load — 10 pts (guideline: keep ≤25% of income)
  const yearStart = `${new Date().getFullYear()}-01-01`;
  const remYear = remittances
    .filter((r) => r.date >= yearStart)
    .reduce((s, r) => s + toBase(r.amount + r.fee, r.currency, settings), 0);
  const remRatio = income > 0 ? remYear / (income * 12) : 0;
  const remPts = remYear === 0 ? 5 : Math.round(Math.max(0, Math.min(1, (0.25 - remRatio) / 0.25)) * 10);
  parts.push({
    label: "Remittance balance",
    pts: remPts,
    max: 10,
    hint:
      remYear === 0
        ? "No home transfers logged this year."
        : `Home transfers ≈ ${Math.round(remRatio * 100)}% of income. Keeping ≤25% leaves room to save.`,
  });

  // 5) Money hygiene — 10 pts (budgets set, goals, bills tracked, data present)
  let hygiene = 0;
  if (budgets.length > 0) hygiene += 3;
  if (goals.length > 0) hygiene += 3;
  if (bills.length > 0) hygiene += 2;
  if (args.txns.length >= 10) hygiene += 2;
  parts.push({
    label: "Money hygiene",
    pts: hygiene,
    max: 10,
    hint: "Budgets, goals and bill tracking set you up for success.",
  });

  const score = Math.max(0, Math.min(100, parts.reduce((s, p) => s + p.pts, 0)));
  const band: HealthResult["band"] =
    score >= 80 ? "Excellent" : score >= 60 ? "Good" : score >= 40 ? "Fair" : "Needs Work";
  const color = score >= 80 ? "#10b981" : score >= 60 ? "#84cc16" : score >= 40 ? "#f59e0b" : "#ef4444";
  return { score, band, color, parts };
}

// ─── Daily insights for the home screen ──────────────────────────────────────

export interface Insight {
  icon: string;
  tone: "good" | "warn" | "info";
  text: string;
}

export function dailyInsights(args: {
  totals: MonthTotals;
  budgets: { categoryId: number | null; amount: number }[];
  categories: Category[];
  bills: Bill[];
  remittances: Remittance[];
  lastMonthTotals?: MonthTotals;
  settings: AppSettings;
}): Insight[] {
  const { totals, budgets, categories, bills, remittances, lastMonthTotals, settings } = args;
  const out: Insight[] = [];
  const today = todayStr();
  const cur = settings.baseCurrency;
  const month = today.slice(0, 7);
  const daysTotal = daysInMonth(month);
  const dayNum = Number(today.slice(8, 10));
  const daysLeft = Math.max(1, daysTotal - dayNum + 1);

  // Budget pace
  const overall = budgets.find((b) => b.categoryId === null);
  if (overall && overall.amount > 0) {
    const left = round2(overall.amount - totals.expense);
    const perDay = Math.max(0, Math.round(left / daysLeft));
    const pace = (totals.expense / overall.amount) * daysTotal; // projected
    if (left >= 0) {
      out.push({
        icon: "Target",
        tone: pace > overall.amount ? "warn" : "good",
        text: `${Math.round((totals.expense / overall.amount) * 100)}% of budget used — ${perDay.toLocaleString("en-AE")} ${cur}/day left for ${daysLeft} day${daysLeft > 1 ? "s" : ""}.`,
      });
    } else {
      out.push({
        icon: "TrendingDown",
        tone: "warn",
        text: `Budget exceeded by ${Math.abs(left).toLocaleString("en-AE")} ${cur}. Consider a no-spend day or two.`,
      });
    }
  }

  // Top category
  if (totals.byCategory.length > 0 && totals.expense > 0) {
    const top = totals.byCategory[0];
    const cat = categories.find((c) => c.id === top.categoryId);
    if (cat) {
      const pct = Math.round((top.total / totals.expense) * 100);
      out.push({
        icon: cat.icon,
        tone: pct > 40 ? "warn" : "info",
        text: `${cat.name} is your top spend: ${top.total.toLocaleString("en-AE")} ${cur} (${pct}% of the month).`,
      });
    }
  }

  // MoM comparison
  if (lastMonthTotals && lastMonthTotals.expense > 0 && dayNum >= 5) {
    const proj = (totals.expense / dayNum) * daysTotal;
    const diff = Math.round(((proj - lastMonthTotals.expense) / lastMonthTotals.expense) * 100);
    if (Math.abs(diff) >= 10) {
      out.push({
        icon: diff > 0 ? "TrendingDown" : "TrendingUp",
        tone: diff > 0 ? "warn" : "good",
        text:
          diff > 0
            ? `At this pace you'll spend ${diff}% more than ${monthLabel(month).split(" ")[0]}.`
            : `On track to spend ${Math.abs(diff)}% less than last month. Nice!`,
      });
    }
  }

  // Payday countdown
  const payday = settings.payday;
  if (payday >= 1 && payday <= 31) {
    let daysToPay = payday - dayNum;
    if (daysToPay < 0) {
      const dim = daysInMonth(month);
      daysToPay = dim - dayNum + payday;
    }
    if (daysToPay <= 7) {
      out.push({
        icon: "Banknote",
        tone: "info",
        text: `Payday in ${daysToPay === 0 ? "less than a day" : `${daysToPay} day${daysToPay > 1 ? "s" : ""}`} — plan the last stretch.`,
      });
    }
  }

  // Upcoming bills (next 7 days)
  const in7 = new Date();
  in7.setDate(in7.getDate() + 7);
  const soon = bills.filter((b) => b.active && b.nextDue <= in7.toISOString().slice(0, 10));
  if (soon.length > 0) {
    const total = round2(soon.reduce((s, b) => s + toBase(b.amount, b.currency, settings), 0));
    out.push({
      icon: "Receipt",
      tone: "info",
      text: `${soon.length} bill${soon.length > 1 ? "s" : ""} due within 7 days (${total.toLocaleString("en-AE")} ${cur}).`,
    });
  }

  // Remittance share
  const remMonth = remittances
    .filter((r) => r.date.slice(0, 7) === month)
    .reduce((s, r) => s + toBase(r.amount + r.fee, r.currency, settings), 0);
  if (remMonth > 0 && totals.income > 0) {
    const pct = Math.round((remMonth / totals.income) * 100);
    out.push({
      icon: "Send",
      tone: pct > 30 ? "warn" : "info",
      text: `Home transfers are ${pct}% of this month's income${pct > 30 ? " — above the 30% comfort line." : "."}`,
    });
  }

  // VAT
  if (totals.vatTotal > 0) {
    out.push({
      icon: "Receipt",
      tone: "info",
      text: `You paid ${totals.vatTotal.toLocaleString("en-AE")} ${cur} in VAT this month.`,
    });
  }

  return out.slice(0, 5);
}
