"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { type EditedMedicine, saveList } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ChildLang, Food, MealKey, Medicine } from "@/lib/domain/types";
import { CHILD_FOOD, CHILD_MEALS, makeT } from "@/lib/i18n/child";

type Row = EditedMedicine & { needsCheck: boolean; source: Medicine["purposeSource"]; editing: boolean };

export function ListEditor({
  lang,
  callName,
  mode,
  prescriptionId,
  medicines,
  after,
}: {
  lang: ChildLang;
  callName: string;
  mode: "pending" | "active";
  prescriptionId: string | null;
  medicines: Medicine[];
  after: string;
}) {
  const t = makeT(lang, { n: callName });
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(
    medicines.map((m) => ({
      id: m.id ?? null,
      name: m.name,
      strength: m.strength,
      quantity: m.quantity,
      meals: m.meals,
      food: m.food,
      purposeText: m.purpose?.en ?? "",
      purposeChanged: false,
      needsCheck: m.needsCheck,
      source: m.purposeSource,
      editing: m.needsCheck,
    })),
  );
  const [error, setError] = useState("");
  const [saving, start] = useTransition();

  const update = (i: number, patch: Partial<Row>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const toggleMeal = (i: number, k: MealKey) => {
    const meals = rows[i].meals.includes(k) ? rows[i].meals.filter((m) => m !== k) : [...rows[i].meals, k];
    update(i, { meals: (["b", "l", "d"] as MealKey[]).filter((m) => meals.includes(m)) });
  };

  function save() {
    setError("");
    const live = rows.filter((r) => r.name.trim());
    if (live.some((r) => r.meals.length === 0)) return setError(t("mealNeedErr"));
    if (live.some((r) => r.needsCheck && r.editing)) return setError(t("checkFlagErr"));
    start(async () => {
      const res = await saveList(mode, prescriptionId, live);
      if (res.ok) router.push(after);
      else setError(res.error === "meals" ? t("mealNeedErr") : t("saveErr"));
    });
  }

  return (
    <div className="flex flex-1 flex-col gap-3">
      <h1 className="text-2xl leading-tight font-bold">{mode === "pending" ? t("checkTitle") : t("editTitle")}</h1>
      {mode === "pending" && <p className="text-muted-foreground">{t("checkSub")}</p>}

      {rows.map((r, i) =>
        r.editing ? (
          <div key={i} className="flex flex-col gap-3 rounded-2xl bg-card p-4">
            {r.needsCheck && <span className="self-start rounded-full bg-warn-soft px-2.5 py-0.5 text-xs font-bold text-warn">{t("pleaseCheck")}</span>}
            <Field id={`name_${i}`} label={t("medName")} value={r.name} onChange={(v) => update(i, { name: v })} />
            <div className="grid grid-cols-2 gap-2">
              <Field id={`strength_${i}`} label={t("medStrength")} value={r.strength} onChange={(v) => update(i, { strength: v })} />
              <Field id={`qty_${i}`} label={t("medQty")} value={r.quantity} onChange={(v) => update(i, { quantity: v })} />
            </div>
            <Field id={`purpose_${i}`} label={t("medPurpose")} value={r.purposeText} onChange={(v) => update(i, { purposeText: v, purposeChanged: true })} />
            <p className="text-sm text-muted-foreground">{t("whichMeals")}</p>
            <div className="flex flex-wrap gap-2">
              {(["b", "l", "d"] as MealKey[]).map((k) => (
                <Toggle key={k} on={r.meals.includes(k)} onClick={() => toggleMeal(i, k)}>
                  {CHILD_MEALS[lang][k]}
                </Toggle>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">{t("food")}</p>
            <div className="flex flex-wrap gap-2">
              {(["before", "after", "any"] as Food[]).map((f) => (
                <Toggle key={f} on={r.food === f} onClick={() => update(i, { food: f })}>
                  {CHILD_FOOD[lang][f]}
                </Toggle>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="h-10 flex-1 rounded-xl" onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                {t("remove")}
              </Button>
              <Button className="h-10 flex-1 rounded-xl font-bold" onClick={() => update(i, { editing: false, needsCheck: false })}>
                {t("save")}
              </Button>
            </div>
          </div>
        ) : (
          <div key={i} className="flex items-start gap-3 rounded-2xl bg-card p-4">
            <div className="min-w-0 flex-1">
              <p className="font-mono font-medium">
                {r.name} {r.strength}
              </p>
              <p className="text-sm">
                {r.quantity} · {r.meals.map((k) => CHILD_MEALS[lang][k]).join(", ")} · {CHILD_FOOD[lang][r.food]}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("forWord")}: {r.purposeText || t("noPurpose")}
                {r.purposeText && !r.purposeChanged && r.source === "suggested" ? ` (${t("suggested")})` : ""}
                {r.purposeText && !r.purposeChanged && r.source === "prescription" ? ` (${t("fromRx")})` : ""}
              </p>
            </div>
            <Button variant="outline" size="sm" className="rounded-lg" onClick={() => update(i, { editing: true })}>
              {t("edit")}
            </Button>
          </div>
        ),
      )}

      {error ? (
        <p role="alert" className="text-sm text-bad">
          {error}
        </p>
      ) : null}
      <div className="mt-auto pt-2">
        <Button size="lg" className="h-12 w-full rounded-xl text-base font-bold" onClick={save} disabled={saving}>
          {mode === "pending" ? t("approve") : t("saveList")}
        </Button>
      </div>
    </div>
  );
}

function Field({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Input id={id} className="h-11 text-base" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Toggle({ on, children, onClick }: { on: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`rounded-full border px-3.5 py-1.5 text-sm ${on ? "border-primary bg-brand-soft font-bold" : "border-border"}`}
    >
      {children}
    </button>
  );
}
