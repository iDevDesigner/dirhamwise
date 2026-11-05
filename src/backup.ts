import { db, getSettings } from "./db";
import type { Backup } from "./models";
import { vatSplit, monthKey, currencySymbol } from "./format";

function download(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Collect every table into a portable backup object (used by file export AND cloud sync). */
export async function buildBackup(): Promise<Backup> {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    accounts: await db.accounts.toArray(),
    categories: await db.categories.toArray(),
    txns: await db.txns.toArray(),
    recurrings: await db.recurrings.toArray(),
    budgets: await db.budgets.toArray(),
    goals: await db.goals.toArray(),
    bills: await db.bills.toArray(),
    remittances: await db.remittances.toArray(),
    settings: await db.settings.toArray(),
  };
}

/** Full JSON backup of every table — restore-safe. */
export async function exportJSON(): Promise<void> {
  const backup = await buildBackup();
  download(
    `dirhamwise-backup-${new Date().toISOString().slice(0, 10)}.json`,
    JSON.stringify(backup, null, 2),
    "application/json"
  );
}

/** Restore a JSON backup, replacing ALL current data. */
export async function importJSON(json: string): Promise<void> {
  const data = JSON.parse(json) as Backup;
  if (!data || !Array.isArray(data.txns)) throw new Error("Invalid backup file");
  await db.transaction(
    "rw",
    [db.accounts, db.categories, db.txns, db.recurrings, db.budgets, db.goals, db.bills, db.remittances, db.settings],
    async () => {
      await Promise.all([
        db.accounts.clear(),
        db.categories.clear(),
        db.txns.clear(),
        db.recurrings.clear(),
        db.budgets.clear(),
        db.goals.clear(),
        db.bills.clear(),
        db.remittances.clear(),
        db.settings.clear(),
      ]);
      await db.accounts.bulkAdd(data.accounts ?? []);
      await db.categories.bulkAdd(data.categories ?? []);
      await db.txns.bulkAdd(data.txns ?? []);
      await db.recurrings.bulkAdd(data.recurrings ?? []);
      await db.budgets.bulkAdd(data.budgets ?? []);
      await db.goals.bulkAdd(data.goals ?? []);
      await db.bills.bulkAdd(data.bills ?? []);
      await db.remittances.bulkAdd(data.remittances ?? []);
      await db.settings.bulkPut(data.settings ?? []);
    }
  );
}

/** Excel-friendly CSV export of transactions (with BOM, CRLF). */
export async function exportCSV(): Promise<void> {
  const [txns, accounts, categories, settings] = await Promise.all([
    db.txns.orderBy("date").toArray(),
    db.accounts.toArray(),
    db.categories.toArray(),
    getSettings(),
  ]);
  const accName = new Map(accounts.map((a) => [a.id!, a.name]));
  const catName = new Map(categories.map((c) => [c.id!, c.name]));

  const esc = (v: string | number): string => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = ["Date", "Type", "Category", "Account", "Amount", "Currency", `Amount (${settings.baseCurrency})`, "VAT Rate %", "VAT Amount", "Note"];
  const rows = txns.map((t) => {
    const rate = t.currency === settings.baseCurrency ? 1 : settings.rates[t.currency] ?? 1;
    const inBase = t.type === "transfer" ? "" : (t.amount * rate).toFixed(2);
    const vat = t.vat ? vatSplit(t.amount, t.vatRate).vat.toFixed(2) : "";
    return [
      t.date,
      t.type,
      t.categoryId != null ? catName.get(t.categoryId) ?? "" : t.type === "transfer" ? "Transfer" : "",
      accName.get(t.accountId) ?? "",
      t.amount.toFixed(2),
      t.currency,
      inBase,
      t.vat ? String(t.vatRate) : "",
      vat,
      t.note,
    ]
      .map(esc)
      .join(",");
  });
  const csv = "\uFEFF" + [header.join(","), ...rows].join("\r\n");
  download(`dirhamwise-transactions-${new Date().toISOString().slice(0, 10)}.csv`, csv, "text/csv;charset=utf-8");
}

/** CSV export for the remittance register. */
export async function exportRemittanceCSV(): Promise<void> {
  const rows = await db.remittances.orderBy("date").toArray();
  const esc = (v: string | number): string => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = ["Date", "Amount", "Currency", "Fee", "Service", "Purpose", "Country", "Rate", "Note"];
  const lines = rows.map((r) =>
    [r.date, r.amount, r.currency, r.fee, r.service, r.purpose, r.country, r.rate ?? "", r.note].map(esc).join(",")
  );
  download(
    `dirhamwise-remittances-${new Date().toISOString().slice(0, 10)}.csv`,
    "\uFEFF" + [header.join(","), ...lines].join("\r\n"),
    "text/csv;charset=utf-8"
  );
}

export function monthKeyOf(dateIso: string): string {
  return monthKey(dateIso);
}

export { currencySymbol };
