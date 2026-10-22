"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createFamily } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { mealsInOrder } from "@/lib/domain/meals";
import type { ChildLang, MealKey, ParentLang } from "@/lib/domain/types";
import { CHILD_MEALS, makeT } from "@/lib/i18n/child";
import { PhotoUpload } from "./photo-upload";

const CALL_NAMES = ["Amma", "Papa", "Mummy", "Aai", "Baba"];
const PARENT_LANGS: [ParentLang, string][] = [
  ["en", "English"],
  ["hi", "हिंदी (Hindi)"],
  ["mr", "मराठी (Marathi)"],
];
const TOTAL = 4;

function Chip({ on, children, onClick }: { on: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-full border px-4 py-2 text-[15px] ${on ? "border-primary bg-brand-soft font-bold" : "border-border bg-card"}`}
    >
      {children}
    </button>
  );
}

export function SetupWizard({ defaultName }: { defaultName: string }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [childName, setChildName] = useState(defaultName);
  const [call, setCall] = useState("Amma");
  const [other, setOther] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [childLang, setChildLang] = useState<ChildLang>("en");
  const [parentLang, setParentLang] = useState<ParentLang>("en");
  const [meals, setMeals] = useState<Record<MealKey, string>>({ b: "08:30", l: "13:30", d: "20:30" });
  const [error, setError] = useState("");
  const [saving, start] = useTransition();

  const callName = call === "Other" ? other.trim() : call;
  const t = makeT(childLang, { n: callName || "Amma" });
  const digits = (s: string) => s.replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "");

  function next() {
    setError("");
    if (step === 1) {
      if (!childName.trim()) return setError(t("nameErr"));
      if (!callName) return setError(t("otherErr"));
    }
    if (step === 2 && digits(parentPhone).length !== 10) return setError(t("numErr"));
    if (step === 4) {
      if (!mealsInOrder(meals)) return setError(t("mealOrderErr"));
      start(async () => {
        const res = await createFamily({ childName, callName, parentPhone, childLang, parentLang, meals });
        if (res.ok) setStep(5);
        else setError(res.error === "meals" ? t("mealOrderErr") : res.error === "phone" ? t("numErr") : t("saveErr"));
      });
      return;
    }
    setStep(step + 1);
  }

  if (step === 5) {
    return (
      <div className="flex flex-1 flex-col gap-4">
        <h1 className="text-2xl leading-tight font-bold">{t("photosQ")}</h1>
        <p className="text-muted-foreground">{t("photosSub")}</p>
        <div className="mt-auto flex flex-col gap-2">
          <PhotoUpload label={t("addPhoto")} readingText={t("reading")} errorText={t("readErr")} onDone={() => router.push("/check")} />
          <Button variant="outline" size="lg" className="h-12 rounded-xl" onClick={() => router.refresh()}>
            {t("skip")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <p className="font-mono text-xs text-muted-foreground">{t("step", { a: step, b: TOTAL })}</p>

      {step === 1 && (
        <>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="childName">{t("yourName")}</Label>
            <Input id="childName" className="h-12 text-base" value={childName} onChange={(e) => setChildName(e.target.value)} />
          </div>
          <h1 className="text-2xl leading-tight font-bold">{t("callQ")}</h1>
          <div className="flex flex-wrap gap-2">
            {[...CALL_NAMES, "Other"].map((c) => (
              <Chip key={c} on={call === c} onClick={() => setCall(c)}>
                {c === "Other" ? t("other") : c}
              </Chip>
            ))}
          </div>
          {call === "Other" && <Input id="other" className="h-12 text-base" placeholder={t("otherPlaceholder")} value={other} onChange={(e) => setOther(e.target.value)} />}
          <p className="text-muted-foreground">{t("callSub")}</p>
        </>
      )}

      {step === 2 && (
        <>
          <h1 className="text-2xl leading-tight font-bold">{t("parentNumberQ")}</h1>
          <PhoneInput id="parentPhone" value={parentPhone} onChange={setParentPhone} />
          <p className="text-muted-foreground">{t("parentNumberSub")}</p>
        </>
      )}

      {step === 3 && (
        <>
          <h1 className="text-2xl leading-tight font-bold">{t("langQ")}</h1>
          <p className="text-sm text-muted-foreground">{t("langYou")}</p>
          <div className="flex flex-wrap gap-2">
            <Chip on={childLang === "en"} onClick={() => setChildLang("en")}>
              English
            </Chip>
            <Chip on={childLang === "hi"} onClick={() => setChildLang("hi")}>
              हिंदी (Hindi)
            </Chip>
          </div>
          <p className="text-sm text-muted-foreground">{t("langParent")}</p>
          <div className="flex flex-wrap gap-2">
            {PARENT_LANGS.map(([code, label]) => (
              <Chip key={code} on={parentLang === code} onClick={() => setParentLang(code)}>
                {label}
              </Chip>
            ))}
          </div>
          <p className="text-muted-foreground">{t("langNote")}</p>
        </>
      )}

      {step === 4 && (
        <>
          <h1 className="text-2xl leading-tight font-bold">{t("mealsQ")}</h1>
          <p className="text-muted-foreground">{t("mealsSub")}</p>
          <div className="rounded-2xl bg-card px-4">
            {(["b", "l", "d"] as MealKey[]).map((k) => (
              <div key={k} className="flex items-center justify-between border-b py-3 last:border-0">
                <Label htmlFor={`meal_${k}`} className="text-base">
                  {CHILD_MEALS[childLang][k]}
                </Label>
                <input
                  id={`meal_${k}`}
                  type="time"
                  value={meals[k]}
                  onChange={(e) => setMeals({ ...meals, [k]: e.target.value })}
                  className="rounded-lg border bg-background px-2 py-1.5 font-mono"
                />
              </div>
            ))}
          </div>
        </>
      )}

      {error ? (
        <p role="alert" className="text-sm text-bad">
          {error}
        </p>
      ) : null}

      <div className="mt-auto flex gap-2">
        {step > 1 && (
          <Button variant="outline" size="lg" className="h-12 flex-1 rounded-xl" onClick={() => setStep(step - 1)} disabled={saving}>
            {t("back")}
          </Button>
        )}
        <Button size="lg" className="h-12 flex-[2] rounded-xl text-base font-bold" onClick={next} disabled={saving}>
          {t("next")}
        </Button>
      </div>
    </div>
  );
}

function PhoneInput({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="rounded-lg border bg-card px-3 py-3 font-mono">+91</span>
      <Input id={id} inputMode="numeric" autoComplete="tel-national" className="h-12 text-base" placeholder="98765 43210" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
