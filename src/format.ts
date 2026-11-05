import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  startOfYear,
  subMonths,
  isThisMonth,
  isToday,
  isYesterday,
} from "date-fns";

// ─── Currency ────────────────────────────────────────────────────────────────

export function fmtAmount(n: number, currency = "AED", decimals = 2): string {
  const abs = Math.abs(n);
  const str = abs.toLocaleString("en-AE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${n < 0 ? "-" : ""}${str}`;
}

/** Short symbol for common currencies, else the code. */
export function currencySymbol(code: string): string {
  const map: Record<string, string> = {
    AED: "AED", // dirham — keep code visible (expats recognize AED)
    INR: "₹",
    PKR: "₨",
    PHP: "₱",
    EGP: "E£",
    BDT: "৳",
    LKR: "Rs",
    NPR: "Rs",
    GBP: "£",
    EUR: "€",
    USD: "$",
    SAR: "SR",
    QAR: "QR",
    KWD: "KD",
    BHD: "BD",
    OMR: "OMR",
    JOD: "JD",
    JPY: "¥",
    CNY: "¥",
  };
  return map[code] ?? code;
}

export function fmtMoney(n: number, currency = "AED", decimals = 2): string {
  return `${fmtAmount(n, currency, decimals)} ${currencySymbol(currency)}`;
}

// ─── Dates ───────────────────────────────────────────────────────────────────

export const todayStr = (): string => format(new Date(), "yyyy-MM-dd");

export const monthKey = (d: Date | string): string =>
  typeof d === "string" ? d.slice(0, 7) : format(d, "yyyy-MM");

export const monthLabel = (key: string): string => {
  const [y, m] = key.split("-").map(Number);
  return format(new Date(y, m - 1, 1), "MMMM yyyy");
};

export const monthLabelShort = (key: string): string => {
  const [y, m] = key.split("-").map(Number);
  return format(new Date(y, m - 1, 1), "MMM yy");
};

export function dateLabel(dateStr: string): string {
  const d = parseISO(dateStr);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "EEE, d MMM yyyy");
}

export function dayLabel(dateStr: string): string {
  const d = parseISO(dateStr);
  return format(d, "d MMM");
}

export function monthRange(key: string): { start: string; end: string } {
  const [y, m] = key.split("-").map(Number);
  const start = startOfMonth(new Date(y, m - 1, 1));
  const end = endOfMonth(start);
  return { start: format(start, "yyyy-MM-dd"), end: format(end, "yyyy-MM-dd") };
}

export function yearStart(): string {
  return format(startOfYear(new Date()), "yyyy-MM-dd");
}

export function monthsBack(n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(monthKey(subMonths(new Date(), i)));
  return out;
}

export function daysInMonth(key: string): number {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

// ─── VAT (UAE) ───────────────────────────────────────────────────────────────

export function vatSplit(amount: number, rate: number): { base: number; vat: number } {
  const base = amount / (1 + rate / 100);
  return { base: round2(base), vat: round2(amount - base) };
}

export const round2 = (n: number): number => Math.round(n * 100) / 100;

export function isCurrentMonth(key: string): boolean {
  return isThisMonth(parseISO(`${key}-01`));
}

// ─── IDs ─────────────────────────────────────────────────────────────────────

export const uid = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
