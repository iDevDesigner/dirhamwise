"use client";

import { useState } from "react";
import { useUI } from "@/lib/store";
import { useGoals } from "@/lib/queries";
import { Card, EmptyState, PageFrame, ProgressRing } from "../ui-bits";
import { db } from "@/lib/db";
import { toast } from "sonner";
import { Plus, PiggyBank, Pencil, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { iconFor } from "@/lib/icons";
import { cn } from "@/lib/utils";
import type { Goal } from "@/lib/models";
import React from "react";

const GOAL_ICONS = ["PiggyBank", "Plane", "Home", "Car", "GraduationCap", "Gift", "HeartPulse", "Landmark"];
const GOAL_COLORS = ["#059669", "#0d9488", "#d97706", "#7c3aed", "#e11d48", "#0284c7"];

export default function GoalsView() {
  const back = useUI((s) => s.back);
  const goals = useGoals();
  const [editing, setEditing] = useState<Goal | null>(null);
  const [dlgOpen, setDlgOpen] = useState(false);
  const [contribute, setContribute] = useState<Goal | null>(null);

  const totalTarget = (goals ?? []).reduce((s, g) => s + g.target, 0);
  const totalSaved = (goals ?? []).reduce((s, g) => s + g.saved, 0);

  return (
    <PageFrame
      title="Savings goals"
      subtitle={goals && goals.length > 0 ? `${totalSaved.toLocaleString("en-AE")} of ${totalTarget.toLocaleString("en-AE")} AED saved` : "Save with a plan"}
      onBack={back}
      actions={
        <button
          onClick={() => {
            setEditing(null);
            setDlgOpen(true);
          }}
          aria-label="Add goal"
          className="press w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mr-1"
        >
          <Plus className="w-5 h-5" />
        </button>
      }
    >
      {(!goals || goals.length === 0) && (
        <EmptyState
          icon={<PiggyBank className="w-7 h-7" />}
          title="No goals yet"
          hint="Emergency fund, parents' visit, a car, Eid travel — name it and watch it fill up."
          action={
            <button onClick={() => setDlgOpen(true)} className="press h-10 px-5 rounded-xl hero-grad text-white text-sm font-bold">
              Create your first goal
            </button>
          }
        />
      )}

      <div className="space-y-2.5">
        {(goals ?? []).map((g) => {
          const pct = g.target > 0 ? Math.min(100, Math.round((g.saved / g.target) * 100)) : 0;
          return (
            <Card key={g.id} className="p-4">
              <div className="flex items-center gap-4">
                <ProgressRing pct={pct} size={74} color={g.color}>
                  {React.createElement(iconFor(g.icon), { className: "w-5 h-5", style: { color: g.color } })}
                </ProgressRing>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm">{g.name}</p>
                  <p className="text-lg font-extrabold tnum">
                    {g.saved.toLocaleString("en-AE")} <span className="text-xs text-muted-foreground font-semibold">/ {g.target.toLocaleString("en-AE")} AED</span>
                  </p>
                  {g.deadline && (
                    <p className="text-[11px] text-muted-foreground">
                      Target: {new Date(g.deadline).toLocaleDateString("en-AE", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  )}
                  <div className="flex gap-3 mt-1.5">
                    <button onClick={() => setContribute(g)} className="press text-xs font-bold text-primary">
                      + Add money
                    </button>
                    <button onClick={() => { setEditing(g); setDlgOpen(true); }} className="press text-xs font-bold text-muted-foreground flex items-center gap-0.5">
                      <Pencil className="w-3 h-3" /> Edit
                    </button>
                    <button
                      onClick={async () => {
                        await db.goals.delete(g.id!);
                        toast("Goal deleted");
                      }}
                      className="press text-xs font-bold text-destructive flex items-center gap-0.5"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
              {g.note && <p className="text-xs text-muted-foreground mt-2 pl-1">{g.note}</p>}
            </Card>
          );
        })}
      </div>

      <GoalDialog key={editing ? `e-${editing.id}` : "new"} open={dlgOpen} onClose={() => setDlgOpen(false)} editing={editing} />
      <ContributeDialog goal={contribute} onClose={() => setContribute(null)} />
    </PageFrame>
  );
}

function GoalDialog({ open, onClose, editing }: { open: boolean; onClose: () => void; editing: Goal | null }) {
  const [name, setName] = useState(editing?.name ?? "");
  const [target, setTarget] = useState(String(editing?.target ?? ""));
  const [saved, setSaved] = useState(String(editing?.saved ?? 0));
  const [deadline, setDeadline] = useState(editing?.deadline ?? "");
  const [icon, setIcon] = useState(editing?.icon ?? "PiggyBank");
  const [color, setColor] = useState(editing?.color ?? GOAL_COLORS[0]);
  const [note, setNote] = useState(editing?.note ?? "");

  const save = async () => {
    const t = Number(target);
    if (!name.trim() || !t) {
      toast.error("Name and target amount are needed");
      return;
    }
    const payload = {
      name: name.trim(),
      target: t,
      saved: Number(saved) || 0,
      deadline: deadline || null,
      icon,
      color,
      note: note.trim(),
    };
    if (editing?.id) {
      await db.goals.update(editing.id, payload);
    } else {
      await db.goals.add({ ...payload, createdAt: new Date().toISOString() });
    }
    toast.success("Goal saved");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="rounded-3xl max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit goal" : "New savings goal"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Goal name (e.g. Emergency fund)" value={name} onChange={(e) => setName(e.target.value)} className="h-11 rounded-xl" maxLength={40} />
          <div className="grid grid-cols-2 gap-2">
            <Input type="number" inputMode="decimal" placeholder="Target AED" value={target} onChange={(e) => setTarget(e.target.value)} className="h-11 rounded-xl" />
            <Input type="number" inputMode="decimal" placeholder="Saved so far" value={saved} onChange={(e) => setSaved(e.target.value)} className="h-11 rounded-xl" />
          </div>
          <label className="text-[11px] font-bold text-muted-foreground">Target date (optional)</label>
          <Input type="date" value={deadline ?? ""} onChange={(e) => setDeadline(e.target.value)} className="h-11 rounded-xl" />
          <div>
            <label className="text-[11px] font-bold text-muted-foreground mb-1 block">Icon & colour</label>
            <div className="flex gap-1.5 flex-wrap mb-2">
              {GOAL_ICONS.map((k) => (
                <button key={k} onClick={() => setIcon(k)} className={cn("w-9 h-9 rounded-xl press flex items-center justify-center", icon === k ? "bg-primary/15 ring-1 ring-primary" : "bg-muted")}>
                  {React.createElement(iconFor(k), { className: "w-4.5 h-4.5" })}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              {GOAL_COLORS.map((c) => (
                <button key={c} onClick={() => setColor(c)} aria-label={`colour ${c}`} className={cn("w-7 h-7 rounded-full press", color === c && "ring-2 ring-offset-2 ring-foreground/50")} style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <Input placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} className="h-10 rounded-xl" maxLength={80} />
          <button onClick={save} className="press w-full h-11 rounded-xl hero-grad text-white font-bold">
            {editing ? "Update goal" : "Create goal"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ContributeDialog({ goal, onClose }: { goal: Goal | null; onClose: () => void }) {
  const [amount, setAmount] = useState("");
  if (!goal) return null;
  const add = async () => {
    const amt = Number(amount);
    if (!amt) return;
    await db.goals.update(goal.id!, { saved: Math.round((goal.saved + amt) * 100) / 100 });
    toast.success(`${amt.toLocaleString("en-AE")} AED added to “${goal.name}”`);
    setAmount("");
    onClose();
  };
  return (
    <Dialog open={!!goal} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="rounded-3xl max-w-sm">
        <DialogHeader>
          <DialogTitle>Add to “{goal.name}”</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input type="number" inputMode="decimal" placeholder="Amount AED" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-12 rounded-xl text-lg font-bold" />
          <div className="flex gap-2">
            {[100, 250, 500, 1000].map((v) => (
              <button key={v} onClick={() => setAmount(String(v))} className="press flex-1 h-9 rounded-xl bg-muted text-xs font-bold">
                +{v}
              </button>
            ))}
          </div>
          <button onClick={add} className="press w-full h-11 rounded-xl hero-grad text-white font-bold">
            Add to goal
          </button>
          <p className="text-[10px] text-muted-foreground text-center">Goal savings are tracked separately from account balances.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
