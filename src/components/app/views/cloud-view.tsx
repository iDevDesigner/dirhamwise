"use client";

import { useState } from "react";
import { useCloud } from "@/lib/cloud";
import { useUI } from "@/lib/store";
import { PageFrame, Card, SectionTitle } from "../ui-bits";
import { timeAgo } from "@/lib/live-rate";
import { toast } from "sonner";
import {
  Cloud,
  CloudCheck,
  CloudUpload,
  CloudAlert,
  LogOut,
  RefreshCw,
  Download,
  Upload,
  ShieldCheck,
  Mail,
  KeyRound,
  User,
  Info,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export default function CloudView() {
  const back = useUI((s) => s.back);
  const { user, checking } = useCloud();

  return (
    <PageFrame title="Account & Cloud Sync" subtitle="Backup across devices" onBack={back}>
      {checking ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">Checking session…</Card>
      ) : user ? (
        <SignedInPanel />
      ) : (
        <AuthPanel />
      )}

      <Card className="p-4 mt-4">
        <div className="flex gap-3">
          <ShieldCheck className="w-5 h-5 text-income shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground leading-relaxed">
            <b className="text-foreground">How sync works:</b> your ledger always lives on this
            device first (offline-ready). While signed in, any change is automatically backed up to
            your private cloud account — one encrypted-password-protected account per email. Sign
            in on another phone with the same account and restore everything in a tap.
          </div>
        </div>
      </Card>
    </PageFrame>
  );
}

function AuthPanel() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const login = useCloud((s) => s.login);
  const register = useCloud((s) => s.register);

  const submit = async () => {
    setBusy(true);
    try {
      if (mode === "signin") {
        await login(email, password);
        toast.success("Signed in — checking cloud backup…");
      } else {
        await register(email, password, name);
        toast.success("Account created — backing up your ledger…");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Card className="p-4">
        <div className="flex items-center gap-3 mb-4">
          <span className="w-11 h-11 rounded-2xl hero-grad text-white flex items-center justify-center">
            <Cloud className="w-5.5 h-5.5" />
          </span>
          <div>
            <p className="font-bold text-sm">Free cloud backup</p>
            <p className="text-[11px] text-muted-foreground">Simple email login · sync across Android, iPhone & web</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1 mb-4">
          {(
            [
              ["signin", "Sign in"],
              ["signup", "Create account"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setMode(k)}
              className={cn(
                "h-9 rounded-xl text-xs font-bold press",
                mode === k ? "bg-background shadow-sm" : "text-muted-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="space-y-2.5">
          {mode === "signup" && (
            <Field icon={<User className="w-4 h-4" />}>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name (optional)"
                className="h-11 rounded-xl"
                maxLength={40}
              />
            </Field>
          )}
          <Field icon={<Mail className="w-4 h-4" />}>
            <Input
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="h-11 rounded-xl"
            />
          </Field>
          <Field icon={<KeyRound className="w-4 h-4" />}>
            <Input
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (min 6 characters)"
              className="h-11 rounded-xl"
            />
          </Field>
          <button
            onClick={submit}
            disabled={busy || !email || password.length < 6}
            className="press w-full h-11 rounded-xl hero-grad text-white font-bold disabled:opacity-50"
          >
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account & back up"}
          </button>
          <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
            Your data stays on this device unless you sign in. The cloud only stores your backup
            blob, protected by your password — no analytics, no tracking.
          </p>
        </div>
      </Card>
    </>
  );
}

function Field({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/70">{icon}</span>
      <div className="pl-9">{children}</div>
    </div>
  );
}

function SignedInPanel() {
  const { user, status, lastSync, error, conflictSavedAt, cloudSavedAt } = useCloud();
  const backupNow = useCloud((s) => s.backupNow);
  const restoreFromCloud = useCloud((s) => s.restoreFromCloud);
  const resolveConflict = useCloud((s) => s.resolveConflict);
  const logout = useCloud((s) => s.logout);
  const [busy, setBusy] = useState<"" | "backup" | "restore" | "logout">("");

  const run = async (what: "backup" | "restore" | "logout") => {
    setBusy(what);
    try {
      if (what === "backup") {
        await backupNow();
        toast.success("Backup pushed to cloud");
      } else if (what === "restore") {
        await restoreFromCloud();
        toast.success("Restored from cloud — every screen is live again");
      } else {
        await logout();
        toast("Signed out — data stays on this device");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy("");
    }
  };

  const StatusIcon = status === "error" ? CloudAlert : status === "synced" ? CloudCheck : status === "syncing" ? CloudUpload : Cloud;

  return (
    <>
      {/* Account */}
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-2xl hero-grad text-white flex items-center justify-center text-lg font-extrabold">
            {(user?.name ?? user?.email ?? "?").slice(0, 1).toUpperCase()}
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm truncate">{user?.name || "DirhamWise user"}</p>
            <p className="text-[11px] text-muted-foreground truncate">{user?.email}</p>
          </div>
          <StatusIcon
            className={cn(
              "w-5 h-5 shrink-0",
              status === "error" ? "text-expense" : status === "synced" ? "text-income" : status === "syncing" ? "text-primary animate-pulse" : "text-muted-foreground"
            )}
          />
        </div>
        <p className="text-[11px] text-muted-foreground mt-3 flex items-center justify-between">
          <span>
            {status === "syncing"
              ? "Syncing now…"
              : status === "error"
                ? error || "Sync error"
                : lastSync
                  ? `Auto-sync on · last synced ${timeAgo(lastSync)}`
                  : "Auto-sync on · not synced yet"}
          </span>
          {cloudSavedAt && (
            <span className="tnum">cloud copy: {timeAgo(cloudSavedAt)}</span>
          )}
        </p>
      </Card>

      {/* Conflict */}
      {conflictSavedAt && (
        <Card className="p-4 mt-3 border-amber-500/40 bg-amber-500/5">
          <div className="flex items-center gap-2 mb-1">
            <CloudAlert className="w-4.5 h-4.5 text-amber-500" />
            <p className="text-sm font-bold">Two versions found</p>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed mb-3">
            This device has unsynced changes <b>and</b> the cloud has a newer backup (
            {new Date(conflictSavedAt).toLocaleString("en-AE", { dateStyle: "medium", timeStyle: "short" })}
            ). Pick which one wins:
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => resolveConflict("local").then(() => toast.success("This device's data pushed to cloud")).catch(() => toast.error("Push failed"))}
              className="press h-10 rounded-xl bg-primary/10 text-primary text-xs font-bold"
            >
              Keep this device
            </button>
            <button
              onClick={() => resolveConflict("cloud").then(() => toast.success("Cloud backup restored")).catch(() => toast.error("Restore failed"))}
              className="press h-10 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 text-xs font-bold"
            >
              Use cloud backup
            </button>
          </div>
        </Card>
      )}

      {/* Actions */}
      <SectionTitle>Sync actions</SectionTitle>
      <Card className="divide-y divide-border/60 px-3 py-1">
        <SyncRow
          icon={<CloudUpload className="w-4.5 h-4.5" />}
          color="#059669"
          label="Backup now"
          sub="Push this device's full ledger to the cloud"
          busy={busy === "backup"}
          onClick={() => run("backup")}
        />
        <SyncRow
          icon={<Download className="w-4.5 h-4.5" />}
          color="#7c3aed"
          label="Restore from cloud"
          sub={cloudSavedAt ? "Replace this device with the cloud copy" : "No cloud backup yet"}
          busy={busy === "restore"}
          disabled={!cloudSavedAt}
          onClick={() => run("restore")}
        />
        <SyncRow
          icon={<LogOut className="w-4.5 h-4.5" />}
          color="#64748b"
          label="Sign out"
          sub="Local data stays on this device"
          busy={busy === "logout"}
          onClick={() => run("logout")}
        />
      </Card>

      <Card className="p-4 mt-4">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Everything syncs: transactions, accounts, categories, budgets, goals, bills, recurring
            rules, home transfers and settings. Large backups (years of data) are well within the
            free tier&apos;s limits.
          </p>
        </div>
      </Card>
    </>
  );
}

function SyncRow({
  icon,
  color,
  label,
  sub,
  onClick,
  busy,
  disabled,
}: {
  icon: React.ReactNode;
  color: string;
  label: string;
  sub: string;
  onClick: () => void;
  busy?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || busy}
      className="w-full flex items-center gap-3 py-3 text-left press disabled:opacity-40"
    >
      <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}1c`, color }}>
        {busy ? <RefreshCw className="w-4.5 h-4.5 animate-spin" /> : icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-bold">{label}</span>
        <span className="block text-[11px] text-muted-foreground">{sub}</span>
      </span>
      {busy && <Upload className="w-4 h-4 text-muted-foreground animate-pulse" />}
    </button>
  );
}
