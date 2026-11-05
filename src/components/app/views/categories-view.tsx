"use client";

import { useMemo, useState } from "react";
import { useUI } from "@/lib/store";
import { useData } from "@/lib/queries";
import { Card, CatIcon, EmptyState, PageFrame } from "../ui-bits";
import { db } from "@/lib/db";
import { toast } from "sonner";
import { Plus, Shapes, Pencil, Check, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Category } from "@/lib/models";

const PALETTE = ["#10b981", "#0d9488", "#f97316", "#f59e0b", "#eab308", "#84cc16", "#22c55e", "#06b6d4", "#0ea5e9", "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#ec4899", "#f43f5e", "#ef4444", "#dc2626", "#64748b", "#78716c"];

export default function CategoriesView() {
  const { data } = useData();
  const back = useUI((s) => s.back);
  const [editing, setEditing] = useState<Category | null>(null);
  const [dlgOpen, setDlgOpen] = useState(false);
  const [typeTab, setTypeTab] = useState<"expense" | "income">("expense");

  const list = useMemo(
    () => (data?.categories ?? []).filter((c) => c.type === typeTab && c.parentId === null).sort((a, b) => a.order - b.order),
    [data, typeTab]
  );

  if (!data) return <div className="min-h-dvh" />;

  return (
    <PageFrame
      title="Categories"
      subtitle={`${data.categories.length} total · tap to rename`}
      onBack={back}
      actions={
        <button
          onClick={() => {
            setEditing(null);
            setDlgOpen(true);
          }}
          aria-label="Add category"
          className="press w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mr-1"
        >
          <Plus className="w-5 h-5" />
        </button>
      }
    >
      <div className="grid grid-cols-2 gap-1.5 mb-3">
        {(["expense", "income"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTypeTab(t)}
            className={cn(
              "h-10 rounded-2xl text-sm font-bold capitalize press",
              typeTab === t ? "bg-primary text-primary-foreground" : "bg-muted/70 text-muted-foreground"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <Card className="divide-y divide-border/60 px-3 py-1">
        {list.length === 0 && <EmptyState icon={<Shapes className="w-7 h-7" />} title="Nothing here" />}
        {list.map((c) => (
          <button
            key={c.id}
            onClick={() => {
              setEditing(c);
              setDlgOpen(true);
            }}
            className="w-full flex items-center gap-3 py-2.5 text-left press"
          >
            <CatIcon category={c} size="sm" />
            <span className="flex-1 text-sm font-semibold truncate">{c.name}</span>
            <span className="text-[10px] text-muted-foreground">{data.categories.filter((s) => s.parentId === c.id).length || ""} </span>
            <Pencil className="w-3.5 h-3.5 text-muted-foreground/50" />
          </button>
        ))}
      </Card>

      <p className="text-[11px] text-muted-foreground mt-3 px-1">
        Presets are tuned for the UAE (DEWA, Salik, Careem…). Add your own — they sync into the picker instantly.
      </p>

      <CatDialog key={editing ? `e-${editing.id}` : "new"} open={dlgOpen} onClose={() => setDlgOpen(false)} editing={editing} type={typeTab} parentOptions={list} />
    </PageFrame>
  );
}

function CatDialog({
  open,
  onClose,
  editing,
  type,
  parentOptions,
}: {
  open: boolean;
  onClose: () => void;
  editing: Category | null;
  type: "expense" | "income";
  parentOptions: Category[];
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [color, setColor] = useState(editing?.color ?? PALETTE[0]);
  const [icon, setIcon] = useState<string>(editing?.icon ?? "CircleEllipsis");
  const [asSub, setAsSub] = useState<"root" | "sub">(editing?.parentId ? "sub" : "root");
  const [parentId, setParentId] = useState<string>(String(editing?.parentId ?? parentOptions[0]?.id ?? ""));

  const ICON_CHOICES = ["ShoppingCart", "UtensilsCrossed", "Car", "Fuel", "Home", "Smartphone", "Wifi", "GraduationCap", "HeartPulse", "Dumbbell", "ShoppingBag", "Scissors", "HandHeart", "Users", "Clapperboard", "Plane", "Baby", "PawPrint", "Receipt", "Landmark", "Banknote", "Briefcase", "TrendingUp", "Gift", "Coffee", "Gamepad2", "CircleEllipsis"];

  const save = async () => {
    if (!name.trim()) {
      toast.error("Enter a name");
      return;
    }
    const payload = {
      name: name.trim(),
      type: editing?.type ?? type,
      icon,
      color,
      parentId: asSub === "sub" && parentId ? Number(parentId) : null,
      order: editing?.order ?? 99,
    };
    if (editing?.id) {
      await db.categories.update(editing.id, payload);
      toast.success("Category updated");
    } else {
      await db.categories.add(payload);
      toast.success("Category added");
    }
    onClose();
  };

  const del = async () => {
    if (!editing?.id || !editing) return;
    const txns = await db.txns.where("categoryId").equals(editing.id).count();
    const children = await db.categories.where("parentId").equals(editing.id).count();
    if (txns > 0 || children > 0) {
      toast.error("Category is in use — reassign its transactions/subcategories first");
      return;
    }
    await db.categories.delete(editing.id);
    toast("Category deleted");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="rounded-3xl max-w-md max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit category" : "New category"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className="h-11 rounded-xl" maxLength={30} />
          {!editing && (
            <div className="grid grid-cols-2 gap-1.5">
              <button onClick={() => setAsSub("root")} className={cn("h-10 rounded-xl text-sm font-bold press", asSub === "root" ? "bg-primary text-primary-foreground" : "bg-muted")}>
                Main category
              </button>
              <button onClick={() => setAsSub("sub")} className={cn("h-10 rounded-xl text-sm font-bold press", asSub === "sub" ? "bg-primary text-primary-foreground" : "bg-muted")}>
                Subcategory
              </button>
            </div>
          )}
          {asSub === "sub" && !editing && (
            <div>
              <label className="text-[11px] font-bold text-muted-foreground mb-1 block">Under</label>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                {parentOptions.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setParentId(String(p.id))}
                    className={cn("h-8 px-3 rounded-full text-xs font-bold press flex items-center gap-1", parentId === String(p.id) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}
                  >
                    {parentId === String(p.id) && <Check className="w-3 h-3" />}
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="text-[11px] font-bold text-muted-foreground mb-1 block">Icon</label>
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
              {ICON_CHOICES.map((k) => (
                <button key={k} onClick={() => setIcon(k)} className={cn("h-9 w-9 rounded-xl press", icon === k ? "bg-primary/15 ring-1 ring-primary" : "bg-muted")}>
                  <CatIcon category={{ icon: k, color } as Category} size="sm" />
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[11px] font-bold text-muted-foreground mb-1 block">Colour</label>
            <div className="flex flex-wrap gap-1.5">
              {PALETTE.map((c) => (
                <button key={c} onClick={() => setColor(c)} aria-label={c} className={cn("w-7 h-7 rounded-full press", color === c && "ring-2 ring-offset-2 ring-foreground/50")} style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            {editing && (
              <button onClick={del} className="press h-11 px-4 rounded-xl bg-destructive/10 text-destructive text-sm font-bold flex items-center gap-1">
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            )}
            <button onClick={save} className="press flex-1 h-11 rounded-xl hero-grad text-white font-bold">
              {editing ? "Update" : "Add category"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
