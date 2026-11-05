"use client";

import { create } from "zustand";
import type { Txn, TxnType } from "./models";

export type View =
  | "home"
  | "transactions"
  | "calendar"
  | "stats"
  | "more"
  | "accounts"
  | "budgets"
  | "goals"
  | "remittance"
  | "bills"
  | "settings"
  | "glance"
  | "recurrings"
  | "categories"
  | "cloud";

interface UIState {
  view: View;
  history: View[];
  addOpen: boolean;
  addType: TxnType;
  editing: Txn | null;
  prefillDate: string | null; // calendar day tap → add
  setView: (v: View, push?: boolean) => void;
  back: () => void;
  openAdd: (type?: TxnType, date?: string | null) => void;
  closeAdd: () => void;
  editTxn: (t: Txn) => void;
}

export const useUI = create<UIState>((set, get) => ({
  view: "home",
  history: [],
  addOpen: false,
  addType: "expense",
  editing: null,
  prefillDate: null,
  setView: (v, push = true) =>
    set((s) => ({ view: v, history: push ? [...s.history, s.view] : s.history })),
  back: () => {
    const { history } = get();
    const prev = history[history.length - 1] ?? "home";
    set({ view: prev, history: history.slice(0, -1) });
  },
  openAdd: (type = "expense", date = null) =>
    set({ addOpen: true, addType: type, editing: null, prefillDate: date }),
  closeAdd: () => set({ addOpen: false, editing: null, prefillDate: null }),
  editTxn: (t) => set({ addOpen: true, editing: t }),
}));
