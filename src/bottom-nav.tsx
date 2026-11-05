"use client";

import { useUI } from "@/lib/store";
import { Home, CalendarDays, ChartPie, LayoutGrid, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { key: "home", label: "Home", icon: Home },
  { key: "calendar", label: "Calendar", icon: CalendarDays },
  { key: "__add", label: "", icon: Plus },
  { key: "stats", label: "Stats", icon: ChartPie },
  { key: "more", label: "More", icon: LayoutGrid },
] as const;

export default function BottomNav() {
  const view = useUI((s) => s.view);
  const setView = useUI((s) => s.setView);
  const openAdd = useUI((s) => s.openAdd);

  return (
    <nav
      aria-label="Main navigation"
      className="fixed bottom-0 inset-x-0 z-40 bg-card/90 backdrop-blur-lg border-t border-border/70 safe-bottom"
    >
      <div className="mx-auto max-w-lg grid grid-cols-5 items-end px-2 pt-1.5">
        {items.map((it) => {
          if (it.key === "__add") {
            return (
              <div key="add" className="flex justify-center -mt-6">
                <button
                  onClick={() => openAdd("expense")}
                  aria-label="Add transaction"
                  className="press w-14 h-14 rounded-2xl hero-grad text-white shadow-lg shadow-emerald-900/30 flex items-center justify-center ring-4 ring-card"
                >
                  <Plus className="w-7 h-7" strokeWidth={2.6} />
                </button>
              </div>
            );
          }
          const active = view === it.key || (it.key === "more" && !["home", "calendar", "stats"].includes(view));
          const Icon = it.icon;
          return (
            <button
              key={it.key}
              onClick={() => setView(it.key as "home" | "calendar" | "stats" | "more")}
              className={cn(
                "flex flex-col items-center gap-0.5 py-2 rounded-xl press",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="w-[22px] h-[22px]" strokeWidth={active ? 2.4 : 2} />
              <span className="text-[10px] font-semibold">{it.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
