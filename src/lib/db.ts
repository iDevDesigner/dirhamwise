import Dexie, { type Table } from "dexie";
import {
  DEFAULT_SETTINGS,
  type Account,
  type AppSettings,
  type Bill,
  type Budget,
  type Category,
  type Goal,
  type Recurring,
  type Remittance,
  type Setting,
  type Txn,
} from "./models";

export class DirhamWiseDB extends Dexie {
  accounts!: Table<Account, number>;
  categories!: Table<Category, number>;
  txns!: Table<Txn, number>;
  recurrings!: Table<Recurring, number>;
  budgets!: Table<Budget, number>;
  goals!: Table<Goal, number>;
  bills!: Table<Bill, number>;
  remittances!: Table<Remittance, number>;
  settings!: Table<Setting, string>;

  constructor() {
    super("dirhamwise");
    this.version(1).stores({
      accounts: "++id, name, type",
      categories: "++id, name, type, parentId",
      txns: "++id, type, date, accountId, categoryId, recurringId, [accountId+date]",
      recurrings: "++id, nextDate, active",
      budgets: "++id, categoryId",
      goals: "++id",
      bills: "++id, nextDue, active",
      remittances: "++id, date",
      settings: "key",
    });
  }
}

export const db = new DirhamWiseDB();

// ─── Seed data: UAE-expat presets ────────────────────────────────────────────

interface SeedCategory {
  name: string;
  icon: string;
  color: string;
  subs?: { name: string; icon?: string }[];
}

const EXPENSE_SEED: SeedCategory[] = [
  {
    name: "Groceries", icon: "ShoppingCart", color: "#10b981",
    subs: [{ name: "Carrefour" }, { name: "Lulu Hypermarket" }, { name: "Spinneys" }, { name: "Viva / Baqala" }],
  },
  {
    name: "Dining Out", icon: "UtensilsCrossed", color: "#f97316",
    subs: [{ name: "Talabat" }, { name: "Deliveroo" }, { name: "Careem Food" }, { name: "Café" }, { name: "Restaurant" }],
  },
  {
    name: "Transport", icon: "Car", color: "#3b82f6",
    subs: [{ name: "Careem" }, { name: "Uber" }, { name: "Metro / Nol" }, { name: "Taxi" }, { name: "Parking" }],
  },
  { name: "Fuel", icon: "Fuel", color: "#64748b", subs: [{ name: "ENOC / EPPCO" }, { name: "ADNOC" }] },
  { name: "Salik & Tolls", icon: "Route", color: "#8b5cf6" },
  {
    name: "Rent & Housing", icon: "Home", color: "#06b6d4",
    subs: [{ name: "Rent" }, { name: "DEWA / SEWA / ADDC" }, { name: "Gas" }, { name: "Chiller / AC" }],
  },
  {
    name: "Telecom", icon: "Smartphone", color: "#0ea5e9",
    subs: [{ name: "du" }, { name: "e& (Etisalat)" }, { name: "Virgin Mobile" }],
  },
  { name: "Internet & TV", icon: "Wifi", color: "#14b8a6" },
  {
    name: "Education", icon: "GraduationCap", color: "#a855f7",
    subs: [{ name: "School Fees" }, { name: "Tuition" }, { name: "Books & Supplies" }],
  },
  {
    name: "Health", icon: "HeartPulse", color: "#ef4444",
    subs: [{ name: "Pharmacy" }, { name: "Clinic" }, { name: "Insurance" }],
  },
  { name: "Fitness", icon: "Dumbbell", color: "#f43f5e" },
  {
    name: "Shopping", icon: "ShoppingBag", color: "#ec4899",
    subs: [{ name: "Malls" }, { name: "Noon" }, { name: "Amazon.ae" }, { name: "Clothing" }],
  },
  { name: "Personal Care", icon: "Scissors", color: "#d946ef" },
  { name: "Laundry", icon: "Shirt", color: "#6366f1" },
  { name: "Charity & Zakat", icon: "HandHeart", color: "#22c55e" },
  { name: "Family Support", icon: "Users", color: "#84cc16" },
  {
    name: "Entertainment", icon: "Clapperboard", color: "#eab308",
    subs: [{ name: "Cinema" }, { name: "Events" }, { name: "Games" }],
  },
  { name: "Travel", icon: "Plane", color: "#0891b2" },
  { name: "Kids", icon: "Baby", color: "#f59e0b" },
  { name: "Pets", icon: "PawPrint", color: "#a16207" },
  { name: "Fees & Charges", icon: "Receipt", color: "#78716c", subs: [{ name: "Bank Fees" }, { name: "Interest" }] },
  {
    name: "Govt & Fines", icon: "Landmark", color: "#dc2626",
    subs: [{ name: "Traffic Fines" }, { name: "Visa Fees" }],
  },
  { name: "Other Expense", icon: "CircleEllipsis", color: "#94a3b8" },
];

const INCOME_SEED: SeedCategory[] = [
  { name: "Salary", icon: "Banknote", color: "#10b981" },
  { name: "Bonus & Overtime", icon: "Sparkles", color: "#f59e0b" },
  { name: "Freelance & Side", icon: "Briefcase", color: "#6366f1" },
  { name: "Investments", icon: "TrendingUp", color: "#0ea5e9" },
  { name: "Rental Income", icon: "Building2", color: "#8b5cf6" },
  { name: "Gifts", icon: "Gift", color: "#ec4899" },
  { name: "Refunds & Cashback", icon: "RotateCcw", color: "#22c55e" },
  { name: "Other Income", icon: "CirclePlus", color: "#94a3b8" },
];

// Default accounts created on first launch (fully editable)
const DEFAULT_ACCOUNTS: Omit<Account, "createdAt">[] = [
  { name: "Cash Wallet", type: "cash", currency: "AED", initial: 0, color: "emerald", icon: "Wallet", includeInNet: 1, archived: 0 },
  { name: "Main Bank", type: "bank", currency: "AED", initial: 0, color: "teal", icon: "Landmark", includeInNet: 1, archived: 0 },
  { name: "Savings", type: "savings", currency: "AED", initial: 0, color: "gold", icon: "PiggyBank", includeInNet: 1, archived: 0 },
];

// Approximate snapshot rates: 1 unit of currency → AED. User editable.
export const DEFAULT_RATES: Record<string, number> = {
  AED: 1,
  USD: 3.6725, // pegged
  SAR: 0.9793, // pegged
  QAR: 1.0071, // pegged
  KWD: 11.9861, // pegged
  BHD: 9.7416, // pegged
  OMR: 9.5424, // pegged
  JOD: 5.1812, // pegged
  INR: 0.0415,
  PKR: 0.0131,
  PHP: 0.0623,
  EGP: 0.0763,
  BDT: 0.0301,
  LKR: 0.0125,
  NPR: 0.0262,
  GBP: 4.83,
  EUR: 4.26,
  JPY: 0.0245,
  CNY: 0.515,
};

export const CURRENCY_LIST = Object.keys(DEFAULT_RATES);

export async function ensureSeeded(): Promise<void> {
  const catCount = await db.categories.count();
  if (catCount === 0) {
    const now = new Date().toISOString();
    const expenseCats: Category[] = [];
    const incomeCats: Category[] = [];
    const subs: Category[] = [];
    EXPENSE_SEED.forEach((c, i) => {
      expenseCats.push({ name: c.name, type: "expense", icon: c.icon, color: c.color, parentId: null, order: i });
    });
    INCOME_SEED.forEach((c, i) => {
      incomeCats.push({ name: c.name, type: "income", icon: c.icon, color: c.color, parentId: null, order: i });
    });
    const addedParents = await db.categories.bulkAdd([...expenseCats, ...incomeCats], { allKeys: true });
    EXPENSE_SEED.forEach((c, i) => {
      (c.subs ?? []).forEach((s) => {
        subs.push({
          name: s.name,
          type: "expense",
          icon: s.icon ?? c.icon,
          color: c.color,
          parentId: addedParents[i] as number,
          order: i,
        });
      });
    });
    if (subs.length) await db.categories.bulkAdd(subs);

    await db.accounts.bulkAdd(DEFAULT_ACCOUNTS.map((a) => ({ ...a, createdAt: now })));

    await db.settings.bulkPut([
      { key: "baseCurrency", value: JSON.stringify("AED") },
      { key: "rates", value: JSON.stringify(DEFAULT_RATES) },
      { key: "vatRate", value: JSON.stringify(5) },
      { key: "payday", value: JSON.stringify(28) },
      { key: "profileName", value: JSON.stringify("") },
      { key: "onboarded", value: JSON.stringify(false) },
      { key: "lockEnabled", value: JSON.stringify(false) },
      { key: "pinHash", value: JSON.stringify("") },
    ]);
  }
}

// ─── Settings helpers ────────────────────────────────────────────────────────

export async function getSettings(): Promise<AppSettings> {
  const rows = await db.settings.toArray();
  const map: Record<string, unknown> = {};
  for (const r of rows) {
    try {
      map[r.key] = JSON.parse(r.value);
    } catch {
      map[r.key] = r.value;
    }
  }
  return { ...DEFAULT_SETTINGS, ...map } as AppSettings;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value: JSON.stringify(value) });
}
