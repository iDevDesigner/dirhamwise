"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import type { Category } from "@/lib/models";
import { CatIcon } from "./ui-bits";
import { ChevronLeft, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export default function CategoryPicker({
  type,
  valueId,
  onPick,
}: {
  type: "expense" | "income";
  valueId: number | null;
  onPick: (c: Category | null) => void;
}) {
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? [];
  const [openParent, setOpenParent] = useState<number | null>(null);

  const parents = useMemo(
    () => categories.filter((c) => c.type === type && c.parentId === null).sort((a, b) => a.order - b.order),
    [categories, type]
  );
  const children = useMemo(
    () => (openParent ? categories.filter((c) => c.parentId === openParent) : []),
    [categories, openParent]
  );
  const parent = openParent ? categories.find((c) => c.id === openParent) : null;
  const selected = valueId ? categories.find((c) => c.id === valueId) : null;

  return (
    <div>
      {parent ? (
        <div>
          <button
            onClick={() => setOpenParent(null)}
            className="flex items-center gap-1 text-sm font-semibold text-primary mb-2 press"
          >
            <ChevronLeft className="w-4 h-4" /> {parent.name}
          </button>
          <div className="grid grid-cols-3 min-[380px]:grid-cols-4 gap-2">
            <PickTile
              cat={parent}
              selected={selected?.id === parent.id}
              onClick={() => {
                onPick(parent);
                setOpenParent(null);
              }}
            />
            {children.map((ch) => (
              <PickTile
                key={ch.id}
                cat={ch}
                selected={selected?.id === ch.id}
                onClick={() => {
                  onPick(ch);
                  setOpenParent(null);
                }}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 min-[380px]:grid-cols-4 gap-2">
          {parents.map((p) => (
            <PickTile
              key={p.id}
              cat={p}
              selected={selected?.id === p.id}
              hasSubs={categories.some((c) => c.parentId === p.id)}
              onClick={() => {
                const hasSubs = categories.some((c) => c.parentId === p.id);
                if (hasSubs) setOpenParent(p.id!);
                else onPick(p);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PickTile({
  cat,
  selected,
  hasSubs,
  onClick,
}: {
  cat: Category;
  selected: boolean;
  hasSubs?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-2xl border press relative",
        selected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border/60 bg-card hover:bg-accent/50"
      )}
    >
      {selected && (
        <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
          <Check className="w-3 h-3" />
        </span>
      )}
      <CatIcon category={cat} />
      <span className="text-[11px] leading-tight text-center font-medium line-clamp-2 text-foreground/90">
        {cat.name}
        {hasSubs ? " ›" : ""}
      </span>
    </button>
  );
}
