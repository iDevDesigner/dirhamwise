"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Download, PlusSquare } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

const DISMISSED_KEY = "dw-install-dismissed";

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function platform(): "ios" | "android" | "other" {
  const ua = window.navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && "ontouchend" in document)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "other";
}

export default function InstallHint() {
  const [show, setShow] = useState(false);
  const [deferred, setDeferred] = useState<{ prompt: () => Promise<void> } | null>(null);

  // Derived (not stored) — recomputed whenever the banner becomes visible.
  const os = useMemo<"ios" | "android" | "other">(
    () => (typeof window === "undefined" || show === false ? "other" : platform()),
    [show]
  );

  useEffect(() => {
    if (isStandalone()) return;
    if (localStorage.getItem(DISMISSED_KEY)) return;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as unknown as { prompt: () => Promise<void> });
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    // iOS never fires beforeinstallprompt — show the manual hint after a delay
    const t = setTimeout(() => {
      if (platform() === "ios") setShow(true);
    }, 4000);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      clearTimeout(t);
    };
  }, []);

  const dismiss = () => {
    setShow(false);
    localStorage.setItem(DISMISSED_KEY, "1");
  };

  const installAndroid = async () => {
    if (deferred) {
      await deferred.prompt();
      dismiss();
    }
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          className="fixed inset-x-3 bottom-24 z-40 mx-auto max-w-md"
        >
          <div className="rounded-3xl bg-card border border-border shadow-xl shadow-emerald-900/10 p-4 flex gap-3">
            <div className="w-11 h-11 rounded-2xl hero-grad flex items-center justify-center text-white shrink-0">
              <Download className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold">Install DirhamWise</p>
              {os === "ios" ? (
                <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                  Tap <PlusSquare className="inline w-3.5 h-3.5 -mt-0.5 mx-0.5" /> <b>Share → Add to Home Screen</b> for the full app experience — works offline, opens like a native app.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                  Add DirhamWise to your home screen for offline access and instant launching.
                </p>
              )}
              {os === "android" && (
                <button onClick={installAndroid} className="mt-2 h-9 px-4 rounded-xl hero-grad text-white text-xs font-bold press">
                  Install now
                </button>
              )}
            </div>
            <button onClick={dismiss} aria-label="Dismiss" className="press w-8 h-8 rounded-full hover:bg-accent flex items-center justify-center text-muted-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
