"use client";

import { create } from "zustand";
import type { Backup } from "./models";
import { buildBackup, importJSON } from "./backup";
import { db } from "./db";

// ─── Optional account & cloud sync ───────────────────────────────────────────
// The app stays offline-first: the ledger always lives in the device's
// IndexedDB. Signing in adds a cloud backup (one JSON blob per user) so data
// survives lost phones and can move between devices. A fingerprint watcher
// detects local changes and auto-pushes a fresh backup while signed in.

export interface CloudUser {
  id: string;
  email: string;
  name: string | null;
}

type Status = "idle" | "syncing" | "synced" | "error";

interface CloudState {
  user: CloudUser | null;
  checking: boolean;
  status: Status;
  lastSync: number | null;
  error: string | null;
  /** Cloud backup exists but local ledger has data too — user must choose. */
  conflictSavedAt: string | null;
  cloudSavedAt: string | null;

  init: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  backupNow: () => Promise<void>;
  restoreFromCloud: () => Promise<void>;
  resolveConflict: (choice: "local" | "cloud") => Promise<void>;
}

const LAST_SYNC_KEY = "dw-last-sync";
const FP_KEY = "dw-fingerprint";

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let watchStarted = false;
let lastPushedFp: string | null = null;

function readLastSync(): number | null {
  try {
    const v = localStorage.getItem(LAST_SYNC_KEY);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}

function writeLastSync(ms: number | null) {
  try {
    if (ms == null) localStorage.removeItem(LAST_SYNC_KEY);
    else localStorage.setItem(LAST_SYNC_KEY, String(ms));
  } catch {
    /* ignore */
  }
}

function storeFingerprint(fp: string | null) {
  lastPushedFp = fp;
  try {
    if (fp == null) localStorage.removeItem(FP_KEY);
    else localStorage.setItem(FP_KEY, fp);
  } catch {
    /* ignore */
  }
}

function loadFingerprint(): string | null {
  if (lastPushedFp) return lastPushedFp;
  try {
    lastPushedFp = localStorage.getItem(FP_KEY);
  } catch {
    lastPushedFp = null;
  }
  return lastPushedFp;
}

/** Cheap change detector across every table (counts + newest txn timestamp). */
export async function fingerprint(): Promise<string> {
  const [txns, accounts, categories, recurrings, budgets, goals, bills, remittances, settings] =
    await Promise.all([
      db.txns.count(),
      db.accounts.count(),
      db.categories.count(),
      db.recurrings.count(),
      db.budgets.count(),
      db.goals.count(),
      db.bills.count(),
      db.remittances.count(),
      db.settings.count(),
    ]);
  let maxUpd = "";
  await db.txns.each((t) => {
    if (t.updatedAt > maxUpd) maxUpd = t.updatedAt;
  });
  return [txns, accounts, categories, recurrings, budgets, goals, bills, remittances, settings, maxUpd].join("|");
}

async function me(): Promise<CloudUser | null> {
  try {
    const res = await fetch("/api/auth/me", { cache: "no-store" });
    if (!res.ok) return null;
    const json = await res.json();
    return json.user ?? null;
  } catch {
    return null;
  }
}

export const useCloud = create<CloudState>((set, get) => ({
  user: null,
  checking: true,
  status: "idle",
  lastSync: null,
  error: null,
  conflictSavedAt: null,
  cloudSavedAt: null,

  init: async () => {
    set({ checking: true, lastSync: readLastSync() });
    const user = await me();
    set({ user, checking: false });
    if (user) {
      await reconcileOnLogin(set, get);
      startAutoPush(set, get);
    }
  },

  login: async (email, password) => {
    set({ error: null });
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error ?? "Sign in failed.");
    set({ user: json.user });
    await reconcileOnLogin(set, get);
    startAutoPush(set, get);
  },

  register: async (email, password, name) => {
    set({ error: null });
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error ?? "Could not create the account.");
    set({ user: json.user });
    // Fresh account → push local ledger as the first cloud backup.
    await get().backupNow();
    startAutoPush(set, get);
  },

  logout: async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    set({ user: null, status: "idle", error: null, conflictSavedAt: null, cloudSavedAt: null });
    writeLastSync(null);
  },

  backupNow: async () => {
    const { user } = get();
    if (!user) return;
    set({ status: "syncing", error: null });
    try {
      const blob = await buildBackup();
      const res = await fetch("/api/cloud", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ blob }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Backup failed.");
      const now = Date.now();
      writeLastSync(now);
      storeFingerprint(await fingerprint());
      set({ status: "synced", lastSync: now, cloudSavedAt: json.savedAt, conflictSavedAt: null });
    } catch (err) {
      set({ status: "error", error: err instanceof Error ? err.message : "Backup failed." });
      throw err;
    }
  },

  restoreFromCloud: async () => {
    const { user } = get();
    if (!user) return;
    set({ status: "syncing", error: null });
    try {
      const res = await fetch("/api/cloud", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Could not reach the cloud.");
      if (!json.blob) throw new Error("No cloud backup found for this account.");
      await importJSON(JSON.stringify(json.blob));
      const now = Date.now();
      writeLastSync(now);
      storeFingerprint(await fingerprint());
      set({ status: "synced", lastSync: now, conflictSavedAt: null });
    } catch (err) {
      set({ status: "error", error: err instanceof Error ? err.message : "Restore failed." });
      throw err;
    }
  },

  resolveConflict: async (choice) => {
    if (choice === "cloud") {
      await get().restoreFromCloud();
    } else {
      await get().backupNow();
    }
  },
}));

/** Called right after sign-in: empty local ledger → restore; else flag conflict. */
async function reconcileOnLogin(
  set: (partial: Partial<CloudState>) => void,
  get: () => CloudState
): Promise<void> {
  try {
    const res = await fetch("/api/cloud", { cache: "no-store" });
    if (!res.ok) return;
    const json = (await res.json()) as { savedAt: string | null; blob: Backup | null };
    set({ cloudSavedAt: json.savedAt });

    if (!json.blob) {
      // First time in the cloud → upload what we have.
      await get().backupNow();
      return;
    }

    const localCount = await db.txns.count();
    if (localCount === 0) {
      await get().restoreFromCloud();
      return;
    }

    const last = readLastSync() ?? 0;
    const savedAtMs = json.savedAt ? new Date(json.savedAt).getTime() : 0;
    const localChanged = loadFingerprint() !== (await fingerprint());

    if (savedAtMs > last && localChanged) {
      // Both sides changed since the last sync → let the user decide.
      set({ conflictSavedAt: json.savedAt });
    } else if (savedAtMs > last) {
      // Cloud is newer and local is clean → restore silently.
      await get().restoreFromCloud();
    } else {
      // Local is same/newer → push to be safe.
      await get().backupNow();
    }
  } catch {
    /* offline — auto-push watcher will retry */
  }
}

/**
 * Watch the local fingerprint and push a fresh backup (debounced) whenever
 * the ledger changes while signed in.
 */
function startAutoPush(
  set: (partial: Partial<CloudState>) => void,
  get: () => CloudState
): void {
  if (watchStarted) return;
  watchStarted = true;

  const tick = async () => {
    const { user, conflictSavedAt, status } = get();
    if (!user || conflictSavedAt || status === "syncing") return;
    try {
      const fp = await fingerprint();
      if (fp === loadFingerprint()) return;
      if (pushTimer) clearTimeout(pushTimer);
      pushTimer = setTimeout(async () => {
        try {
          await get().backupNow();
        } catch {
          /* network hiccup — retried on next change */
        }
      }, 3000);
    } catch {
      /* DB busy — next tick retries */
    }
  };

  setInterval(tick, 5000);
  window.addEventListener("online", tick);
}

// Dev/debug handle (harmless in production, useful for support questions).
if (typeof window !== "undefined") {
  (window as unknown as { __dwCloud?: typeof useCloud }).__dwCloud = useCloud;
}
