import { db } from "./db";
import { addDays, addMonths, addYears, format, parseISO } from "date-fns";
import type { Frequency, Recurring, Txn } from "./models";
import { todayStr } from "./format";

function nextDate(from: string, freq: Frequency): string {
  const d = parseISO(from);
  let nd: Date;
  switch (freq) {
    case "daily":
      nd = addDays(d, 1);
      break;
    case "weekly":
      nd = addDays(d, 7);
      break;
    case "biweekly":
      nd = addDays(d, 14);
      break;
    case "monthly":
      nd = addMonths(d, 1);
      break;
    case "quarterly":
      nd = addMonths(d, 3);
      break;
    case "yearly":
      nd = addYears(d, 1);
      break;
    default:
      nd = addMonths(d, 1);
  }
  return format(nd, "yyyy-MM-dd");
}

function txnFromRecurring(r: Recurring, date: string): Txn {
  const now = new Date().toISOString();
  return {
    type: r.type,
    amount: r.amount,
    currency: r.currency,
    categoryId: r.categoryId,
    accountId: r.accountId,
    toAccountId: r.toAccountId,
    date,
    note: r.note,
    vat: r.vat,
    vatRate: r.vatRate,
    recurringId: r.id ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Called on app start: auto-posts any due recurring transactions and
 * advances their nextDate. Non-auto rules are left for user confirmation.
 */
export async function processRecurrings(): Promise<number> {
  const today = todayStr();
  const rules = await db.recurrings.where("active").equals(1).toArray();
  let posted = 0;
  for (const r of rules) {
    if (!r.autoPost || r.nextDate > today) continue;
    let guard = 0;
    let d = r.nextDate;
    while (d <= today && guard < 400) {
      await db.txns.add(txnFromRecurring(r, d));
      posted++;
      d = nextDate(d, r.frequency);
      guard++;
      if (r.endDate && d > r.endDate) break;
    }
    if (r.endDate && d > r.endDate) {
      await db.recurrings.update(r.id!, { active: 0, lastPosted: today, nextDate: d });
    } else {
      await db.recurrings.update(r.id!, { nextDate: d, lastPosted: today });
    }
  }
  return posted;
}

export function previewNextDates(r: Omit<Recurring, "id">, count = 3): string[] {
  const out: string[] = [];
  let d = r.nextDate;
  for (let i = 0; i < count; i++) {
    out.push(d);
    d = nextDate(d, r.frequency);
  }
  return out;
}

export const FREQ_LABEL: Record<Frequency, string> = {
  daily: "Every day",
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};
