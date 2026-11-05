"use client";

import { cn } from "@/lib/utils";

/** Evaluate a + − × ÷ expression left-to-right with operator precedence. */
export function evalExpr(expr: string): number | null {
  const cleaned = expr.replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-");
  const tokens = cleaned.match(/(\d+\.?\d*|\.\d+|[+\-*/])/g);
  if (!tokens || tokens.length === 0) return null;
  // Ensure it starts with a number
  if (/^[+\-*/]/.test(tokens[0]) && tokens[0] !== "-") return null;
  const nums: number[] = [];
  const ops: string[] = [];
  let pendingNeg = false;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (/^[+\-*/]$/.test(t)) {
      if (i === 0) {
        if (t === "-") pendingNeg = true;
        else return null;
      } else {
        ops.push(t);
      }
    } else {
      let n = parseFloat(t);
      if (pendingNeg) {
        n = -n;
        pendingNeg = false;
      }
      const lastOp = ops[ops.length - 1];
      if (lastOp === "*" || lastOp === "/") {
        ops.pop();
        const a = nums.pop() ?? 0;
        if (lastOp === "/" && n === 0) return null;
        nums.push(lastOp === "*" ? a * n : a / n);
      } else {
        nums.push(n);
      }
    }
  }
  let result = nums[0];
  for (let i = 0; i < ops.length; i++) {
    const b = nums[i + 1];
    if (b === undefined) return null;
    result = ops[i] === "+" ? result + b : result - b;
  }
  if (!isFinite(result)) return null;
  return Math.round(result * 100) / 100;
}

const KEYS: { k: string; span?: boolean; variant?: "op" | "danger" | "ok" }[] = [
  { k: "C", variant: "danger" },
  { k: "⌫", variant: "danger" },
  { k: "÷", variant: "op" },
  { k: "×", variant: "op" },
  { k: "7" }, { k: "8" }, { k: "9" }, { k: "−", variant: "op" },
  { k: "4" }, { k: "5" }, { k: "6" }, { k: "+", variant: "op" },
  { k: "1" }, { k: "2" }, { k: "3" }, { k: "=", variant: "ok" },
  { k: "0", span: true }, { k: "." },
];

export default function AmountPad({
  expr,
  onChange,
  onDone,
}: {
  expr: string;
  onChange: (next: string) => void;
  onDone?: () => void;
}) {
  const press = (k: string) => {
    if (navigator.vibrate) navigator.vibrate(8);
    if (k === "C") return onChange("");
    if (k === "⌫") return onChange(expr.slice(0, -1));
    if (k === "=") {
      const r = evalExpr(expr);
      if (r !== null) {
        onChange(String(r));
        onDone?.();
      }
      return;
    }
    if (/[+\-−×÷]/.test(k)) {
      // replace a trailing operator instead of stacking
      if (expr === "") {
        if (k === "−") return onChange("−");
        return;
      }
      if (/[+\-−×÷]$/.test(expr)) return onChange(expr.slice(0, -1) + k);
      return onChange(expr + k);
    }
    if (k === "." && /\.\d*$/.test(expr)) return; // one dot per number
    if (k !== "." && /\d{12,}/.test(expr)) return; // cap length
    onChange(expr + k);
  };

  return (
    <div className="grid grid-cols-4 gap-1.5 select-none" role="group" aria-label="Amount keypad">
      {KEYS.map((key, i) => (
        <button
          key={i}
          type="button"
          onClick={() => press(key.k)}
          className={cn(
            "h-11 rounded-xl text-lg font-semibold press flex items-center justify-center",
            key.span && "col-span-2",
            key.variant === "op" && "bg-accent text-accent-foreground",
            key.variant === "danger" && "bg-destructive/10 text-destructive",
            key.variant === "ok" && "bg-primary text-primary-foreground",
            !key.variant && "bg-muted/70 hover:bg-muted"
          )}
        >
          {key.k}
        </button>
      ))}
    </div>
  );
}
