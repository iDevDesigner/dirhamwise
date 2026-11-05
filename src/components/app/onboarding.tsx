"use client";

import { useState } from "react";
import { db, setSetting } from "@/lib/db";
import { toast } from "sonner";
import { Wallet, User, CalendarClock, Target, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { ProgressRing } from "./ui-bits";

export default function Onboarding({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [payday, setPayday] = useState(28);
  const [budget, setBudget] = useState(5000);

  const finish = async () => {
    await setSetting("profileName", name.trim());
    await setSetting("payday", payday);
    if (budget > 0) {
      await db.budgets.add({ categoryId: null, amount: budget });
    }
    await setSetting("onboarded", true);
    toast.success("Welcome aboard! 🇦🇪", { description: "Your UAE money hub is ready." });
    onDone();
  };

  return (
    <div className="min-h-dvh hero-grad flex flex-col text-white">
      <div className="flex-1 flex flex-col justify-center px-6 py-10 max-w-lg w-full mx-auto">
        {step === 0 && (
          <div className="space-y-6 text-center">
            <div className="w-20 h-20 mx-auto rounded-3xl bg-white/15 backdrop-blur flex items-center justify-center">
              <Wallet className="w-10 h-10" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight">DirhamWise</h1>
              <p className="text-white/80 mt-2 leading-relaxed">
                Expense, budget & remittance manager built for life in the UAE.
                Works offline, stays on your phone, speaks AED.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center text-xs">
              {[
                ["🇦🇪", "AED + 18 currencies"],
                ["📊", "Budgets & VAT reports"],
                ["✈️", "Home transfer tracker"],
              ].map(([e, t]) => (
                <div key={t} className="rounded-2xl bg-white/10 p-3 backdrop-blur">
                  <div className="text-xl mb-1">{e}</div>
                  <div className="text-white/85 font-medium leading-tight">{t}</div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setStep(1)}
              className="press w-full h-13 py-3.5 rounded-2xl bg-white text-emerald-800 font-bold flex items-center justify-center gap-2"
            >
              Get started <ArrowRight className="w-4 h-4" />
            </button>
            <p className="text-[11px] text-white/60">
              Private by design — all data stays in your browser on this device. Export backups anytime.
            </p>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <StepHead icon={<User className="w-5 h-5" />} title="What should we call you?" sub="Used to personalise insights. Optional." />
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="h-12 rounded-2xl bg-white/10 border-white/20 text-white placeholder:text-white/50 text-base"
              maxLength={30}
            />
            <ContinueBtn onClick={() => setStep(2)} />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <StepHead icon={<CalendarClock className="w-5 h-5" />} title="When is payday?" sub="We'll count down and pace your spending." />
            <div className="flex flex-wrap gap-2">
              {[1, 5, 10, 15, 20, 25, 28, 30].map((d) => (
                <button
                  key={d}
                  onClick={() => setPayday(d)}
                  className={`press h-11 px-4 rounded-xl text-sm font-bold ${payday === d ? "bg-white text-emerald-800" : "bg-white/10 text-white"}`}
                >
                  Day {d}
                </button>
              ))}
            </div>
            <p className="text-xs text-white/60">You can fine-tune this in Settings later.</p>
            <ContinueBtn onClick={() => setStep(3)} />
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <StepHead icon={<Target className="w-5 h-5" />} title="Monthly spending budget" sub="An alert line for total expenses each month." />
            <div className="flex items-center gap-4">
              <ProgressRing pct={100} color="#fbbf24" size={72}>
                <span className="text-white font-bold text-xs">AED</span>
              </ProgressRing>
              <Input
                type="number"
                inputMode="numeric"
                value={budget}
                onChange={(e) => setBudget(Number(e.target.value) || 0)}
                className="h-12 rounded-2xl bg-white/10 border-white/20 text-white text-lg font-bold"
              />
            </div>
            <Slider value={[budget]} min={500} max={50000} step={250} onValueChange={([v]) => setBudget(v)} />
            <div className="text-sm text-white/80">
              Suggested: 70% of a typical AED 10k salary ≈ <b>AED 7,000</b>. Adjust anytime in Budgets.
            </div>
            <button
              onClick={finish}
              className="press w-full py-3.5 rounded-2xl bg-white text-emerald-800 font-bold flex items-center justify-center gap-2"
            >
              Start managing money <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
      {step > 0 && (
        <button onClick={() => setStep(step - 1)} className="pb-8 text-white/70 text-sm press">
          Back
        </button>
      )}
    </div>
  );
}

function StepHead({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div className="space-y-2">
      <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center">{icon}</div>
      <h2 className="text-2xl font-extrabold">{title}</h2>
      <p className="text-white/75 text-sm">{sub}</p>
    </div>
  );
}

function ContinueBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="press w-full py-3.5 rounded-2xl bg-white text-emerald-800 font-bold flex items-center justify-center gap-2">
      Continue <ArrowRight className="w-4 h-4" />
    </button>
  );
}
