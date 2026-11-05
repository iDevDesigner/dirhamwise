"use client";

import { useEffect, useState } from "react";
import { useUI } from "@/lib/store";
import { useData } from "@/lib/queries";
import { ensureSeeded, db } from "@/lib/db";
import { processRecurrings } from "@/lib/recurring";
import { toast } from "sonner";
import { Wallet } from "lucide-react";

import BottomNav from "./bottom-nav";
import AddSheet from "./add-sheet";
import LockScreen from "./lock-screen";
import Onboarding from "./onboarding";
import InstallHint from "./install-hint";
import HomeView from "./views/home-view";
import TransactionsView from "./views/transactions-view";
import CalendarView from "./views/calendar-view";
import StatsView from "./views/stats-view";
import MoreView from "./views/more-view";
import AccountsView from "./views/accounts-view";
import BudgetsView from "./views/budgets-view";
import GoalsView from "./views/goals-view";
import RemittanceView from "./views/remittance-view";
import BillsView from "./views/bills-view";
import SettingsView from "./views/settings-view";
import GlanceView from "./views/glance-view";
import RecurringsView from "./views/recurrings-view";
import CategoriesView from "./views/categories-view";
import CloudView from "./views/cloud-view";
import { useCloud } from "@/lib/cloud";

export default function MoneyApp() {
  const { ready } = useData();
  const view = useUI((s) => s.view);
  const setView = useUI((s) => s.setView);
  const openAdd = useUI((s) => s.openAdd);
  const [booted, setBooted] = useState(false);
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  const [locked, setLocked] = useState(false);

  // Boot: seed, process recurring rules, register SW, deep links
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await ensureSeeded();
      const posted = await processRecurrings();
      if (!cancelled && posted > 0) {
        toast.success(`${posted} recurring transaction${posted > 1 ? "s" : ""} posted`, {
          description: "Scheduled rules were applied to your ledger.",
        });
      }
      const settings = await db.settings.get("onboarded");
      const val = settings ? JSON.parse(settings.value) === true : false;
      if (!cancelled) {
        setOnboarded(val);
        setBooted(true);
      }
      // Deep links from PWA shortcuts: /?action=add  /?view=glance
      const params = new URLSearchParams(window.location.search);
      if (params.get("action") === "add") openAdd(params.get("type") === "income" ? "income" : params.get("type") === "transfer" ? "transfer" : "expense");
      else if (params.get("view") === "glance") setView("glance");
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("/sw.js").catch(() => undefined);
      }
      // Cloud sync session check (no-op when signed out)
      void useCloud.getState().init();
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!booted || !ready) {
    return (
      <div className="min-h-dvh hero-grad flex flex-col items-center justify-center gap-4 text-white">
        <div className="w-16 h-16 rounded-3xl bg-white/15 backdrop-blur flex items-center justify-center animate-pulse">
          <Wallet className="w-9 h-9" />
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold tracking-tight">DirhamWise</p>
          <p className="text-white/70 text-sm mt-1">Your money, in dirhams and beyond</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col bg-background">
      {onboarded === false ? (
        <Onboarding
          onDone={() => {
            setOnboarded(true);
          }}
        />
      ) : (
        <AppShell locked={locked} setLocked={setLocked} />
      )}
      {view !== "glance" && <BottomNav />}
      <AddSheet />
      <InstallHint />
      <LockGate locked={locked} setLocked={setLocked} onboarded={onboarded === true} />
    </div>
  );
}

function AppShell({ locked, setLocked }: { locked: boolean; setLocked: (v: boolean) => void }) {
  const view = useUI((s) => s.view);
  if (locked) return null;
  switch (view) {
    case "transactions":
      return <TransactionsView />;
    case "calendar":
      return <CalendarView />;
    case "stats":
      return <StatsView />;
    case "more":
      return <MoreView setLocked={setLocked} />;
    case "accounts":
      return <AccountsView />;
    case "budgets":
      return <BudgetsView />;
    case "goals":
      return <GoalsView />;
    case "remittance":
      return <RemittanceView />;
    case "bills":
      return <BillsView />;
    case "settings":
      return <SettingsView />;
    case "glance":
      return <GlanceView />;
    case "recurrings":
      return <RecurringsView />;
    case "categories":
      return <CategoriesView />;
    case "cloud":
      return <CloudView />;
    default:
      return <HomeView />;
  }
}

function LockGate({
  locked,
  setLocked,
  onboarded,
}: {
  locked: boolean;
  setLocked: (v: boolean) => void;
  onboarded: boolean;
}) {
  const view = useUI((s) => s.view);
  // Lock only applies to the main app (not glance) when enabled
  useEffect(() => {
    if (!onboarded) return;
    (async () => {
      const [lock, pin] = await Promise.all([db.settings.get("lockEnabled"), db.settings.get("pinHash")]);
      const enabled = lock ? JSON.parse(lock.value) === true : false;
      const hash = pin ? JSON.parse(pin.value) : "";
      if (enabled && hash && !sessionStorage.getItem("dw-unlocked")) {
        setLocked(true);
      }
    })();
  }, [onboarded, setLocked]);

  if (!locked || view === "glance") return null;
  return (
    <LockScreen
      onUnlocked={() => {
        sessionStorage.setItem("dw-unlocked", "1");
        setLocked(false);
      }}
    />
  );
}
