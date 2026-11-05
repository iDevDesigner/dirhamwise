"use client";

import { useEffect, useRef, useState } from "react";
import { Delete, Wallet, Fingerprint } from "lucide-react";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashPin(pin: string): Promise<string> {
  return sha256(`dw:${pin}`);
}

export default function LockScreen({ onUnlocked }: { onUnlocked: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [stored, setStored] = useState<string>("");
  const triedBiometric = useRef(false);

  useEffect(() => {
    db.settings.get("pinHash").then((row) => {
      if (row) setStored(JSON.parse(row.value));
    });
  }, []);

  const verify = async (value: string) => {
    const hash = await sha256(`dw:${value}`);
    if (hash === stored) {
      onUnlocked();
    } else {
      setError(true);
      setTimeout(() => {
        setPin("");
        setError(false);
      }, 600);
    }
  };

  const press = (k: string) => {
    if (error) return;
    if (k === "del") {
      setPin((p) => p.slice(0, -1));
      return;
    }
    if (pin.length >= 6) return;
    const next = pin + k;
    setPin(next);
    if (next.length >= 4) verify(next);
  };

  // Try platform biometrics (WebAuthn) if available — best-effort convenience.
  useEffect(() => {
    if (triedBiometric.current || !window.PublicKeyCredential) return;
    triedBiometric.current = true;
    // WebAuthn unlock requires server-side credentials; on PWA standalone we
    // keep the numeric pad as the source of truth. Placeholder for future.
  }, []);

  return (
    <div className="fixed inset-0 z-50 hero-grad flex flex-col items-center justify-center gap-8 text-white px-8">
      <div className="w-16 h-16 rounded-3xl bg-white/15 backdrop-blur flex items-center justify-center">
        <Wallet className="w-8 h-8" />
      </div>
      <div className="text-center">
        <p className="text-xl font-bold">Enter your PIN</p>
        <p className="text-white/70 text-sm mt-1">Your money is locked for privacy</p>
      </div>
      <div className={cn("flex gap-4", error && "animate-pulse")}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={cn(
              "w-3.5 h-3.5 rounded-full border-2 border-white/60 transition-all",
              pin.length > i && "bg-white border-white scale-110",
              error && "border-red-300 bg-red-400/50"
            )}
          />
        ))}
      </div>
      {error && <p className="text-red-200 text-sm font-semibold">Wrong PIN — try again</p>}
      <div className="grid grid-cols-3 gap-4 mt-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((k) => (
          <button
            key={k}
            onClick={() => press(k)}
            className="press w-16 h-16 rounded-full bg-white/10 hover:bg-white/20 text-2xl font-bold flex items-center justify-center"
          >
            {k}
          </button>
        ))}
        <button
          onClick={() => press("del")}
          aria-label="Delete digit"
          className="press w-16 h-16 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
        >
          <Delete className="w-6 h-6" />
        </button>
        <button onClick={() => press("0")} className="press w-16 h-16 rounded-full bg-white/10 hover:bg-white/20 text-2xl font-bold flex items-center justify-center">
          0
        </button>
        <div className="w-16 h-16 rounded-full flex items-center justify-center text-white/40">
          <Fingerprint className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}
