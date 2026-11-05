// ─── Core data models for DirhamWise ─────────────────────────────────────────
// All data lives locally in IndexedDB (offline-first). Amounts are stored as
// positive numbers in their original currency; conversion to base uses rates.

export type TxnType = "expense" | "income" | "transfer";
export type AccountType = "cash" | "bank" | "credit" | "savings" | "wallet";
export type Frequency =
  | "daily"
  | "weekly"
  | "biweekly"
  | "monthly"
  | "quarterly"
  | "yearly";

export interface Account {
  id?: number;
  name: string;
  type: AccountType;
  currency: string;
  initial: number; // opening balance, in account currency
  color: string; // gradient key, see ACCOUNT_GRADIENTS
  icon: string; // lucide icon key
  includeInNet: 0 | 1;
  archived: 0 | 1;
  createdAt: string;
}

export interface Category {
  id?: number;
  name: string;
  type: "expense" | "income";
  icon: string;
  color: string; // hex
  parentId: number | null;
  order: number;
}

export interface Txn {
  id?: number;
  type: TxnType;
  amount: number; // always positive
  currency: string;
  categoryId: number | null;
  accountId: number;
  toAccountId: number | null; // for transfers
  date: string; // YYYY-MM-DD
  note: string;
  vat: 0 | 1; // VAT included in amount (UAE 5%)
  vatRate: number; // e.g. 5
  recurringId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface Recurring {
  id?: number;
  type: TxnType;
  amount: number;
  currency: string;
  categoryId: number | null;
  accountId: number;
  toAccountId: number | null;
  note: string;
  vat: 0 | 1;
  vatRate: number;
  frequency: Frequency;
  nextDate: string;
  endDate: string | null;
  autoPost: 0 | 1;
  active: 0 | 1;
  lastPosted: string | null;
  createdAt: string;
}

export interface Budget {
  id?: number;
  categoryId: number | null; // null = overall monthly budget
  amount: number; // in base currency
}

export interface Goal {
  id?: number;
  name: string;
  target: number;
  saved: number;
  deadline: string | null;
  color: string;
  icon: string;
  note: string;
  createdAt: string;
}

export interface Bill {
  id?: number;
  name: string;
  amount: number;
  currency: string;
  kind: "bill" | "subscription";
  categoryId: number | null;
  accountId: number;
  frequency: "monthly" | "yearly";
  nextDue: string;
  remindDays: number;
  active: 0 | 1;
  createdAt: string;
}

export interface Remittance {
  id?: number;
  date: string;
  amount: number;
  currency: string;
  fee: number;
  rate: number | null; // informational: units received per 1 unit sent
  service: string;
  purpose: string;
  country: string;
  note: string;
  createdAt: string;
}

export interface Setting {
  key: string;
  value: string; // JSON encoded
}

export interface Backup {
  version: number;
  exportedAt: string;
  accounts: Account[];
  categories: Category[];
  txns: Txn[];
  recurrings: Recurring[];
  budgets: Budget[];
  goals: Goal[];
  bills: Bill[];
  remittances: Remittance[];
  settings: Setting[];
}

// App settings stored in the settings table
export interface AppSettings {
  onboarded: boolean;
  profileName: string;
  baseCurrency: string;
  rates: Record<string, number>; // 1 unit of currency = N base units
  vatRate: number;
  payday: number; // day of month salary arrives (1-31)
  lockEnabled: boolean;
  pinHash: string;
  lastRateNote: string;
  autoInr: boolean; // keep INR rate in sync with the live AED→INR feed
}

export const DEFAULT_SETTINGS: AppSettings = {
  onboarded: false,
  profileName: "",
  baseCurrency: "AED",
  rates: {},
  vatRate: 5,
  payday: 28,
  lockEnabled: false,
  pinHash: "",
  lastRateNote: "",
  autoInr: true,
};

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  cash: "Cash",
  bank: "Bank Account",
  credit: "Credit Card",
  savings: "Savings",
  wallet: "Digital Wallet",
};
