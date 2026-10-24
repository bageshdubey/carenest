"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { type EditedMedicine, saveList } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type DuplicateFlag, findDuplicates, medicineKey } from "@/lib/domain/duplicates";
import type { ChildLang, Food, MealKey, Medicine } from "@/lib/domain/types";
import { CHILD_FOOD, CHILD_MEALS, makeT, shortDate } from "@/lib/i18n/child";

type Row = EditedMedicine & { needsCheck: boolean; source: Medicine["purposeSource"]; editing: boolean };

export function ListEditor({
  lang,
  callName,
  mode,
  prescriptionId,
  medicines,
  current,
  after,
}: {
  lang: ChildLang;
  callName: string;
  mode: "pending" | "active";
  prescriptionId: string | null;
  medicines: Medicine[];
  /** The approved list a new prescription will join; empty when editing that list itself. */
  current: Medicine[];
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
      endsOn: m.endsOn ?? "",
      asNeeded: m.asNeeded ?? false,
      needsCheck: m.needsCheck,
      source: m.purposeSource,
      editing: m.needsCheck,
    })),
  );
  const [error, setError] = useState("");
  const [saving, start] = useTransition();
  const duplicates = findDuplicates(rows, current);
  const dupNote = (i: number) => <DuplicateNote flag={duplicates[i]} lang={lang} t={t} />;
  // Ongoing medicines the new prescription does not name: the child says if each is still taken.
  const newKeys = new Set(rows.filter((r) => r.name.trim()).map((r) => medicineKey(r.name)));
  const others = mode === "pending" ? current.filter((m) => m.id && !newKeys.has(medicineKey(m.name))) : [];
  const [keep, setKeep] = useState<Record<string, boolean>>({});

  const update = (i: number, patch: Partial<Row>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const toggled = (current: MealKey[], k: MealKey) => {
    const meals = current.includes(k) ? current.filter((m) => m !== k) : [...current, k];
    return (["b", "l", "d"] as MealKey[]).filter((m) => meals.includes(m));
  };

  function save() {
    setError("");
    const live = rows.filter((r) => r.name.trim());
    if (live.some((r) => !r.asNeeded && r.meals.length === 0)) return setError(t("mealNeedErr"));
    if (live.some((r) => r.needsCheck && r.editing)) return setError(t("checkFlagErr"));
    if (others.some((m) => keep[m.id!] === undefined)) return setError(t("ongoingChooseErr"));
    const stopIds = others.filter((m) => keep[m.id!] === false).map((m) => m.id!);
    start(async () => {
      const res = await saveList(mode, prescriptionId, live, stopIds);
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
            {dupNote(i)}
            <div className="grid grid-cols-2 gap-2">
              <Field id={`strength_${i}`} label={t("medStrength")} value={r.strength} onChange={(v) => update(i, { strength: v })} />
              <Field id={`qty_${i}`} label={t("medQty")} value={r.quantity} onChange={(v) => update(i, { quantity: v })} />
            </div>
            <Field id={`purpose_${i}`} label={t("medPurpose")} value={r.purposeText} onChange={(v) => update(i, { purposeText: v, purposeChanged: true })} />
            <p className="text-sm text-muted-foreground">{t("whichMeals")}</p>
            <div className="flex flex-wrap gap-2">
              {(["b", "l", "d"] as MealKey[]).map((k) => (
                <Toggle key={k} on={!r.asNeeded && r.meals.includes(k)} onClick={() => update(i, { asNeeded: false, meals: toggled(r.meals, k) })}>
                  {CHILD_MEALS[lang][k]}
                </Toggle>
              ))}
              <Toggle on={r.asNeeded} onClick={() => update(i, { asNeeded: !r.asNeeded })}>
                {t("asNeeded")}
              </Toggle>
            </div>
            {r.asNeeded ? (
              <p className="text-xs text-muted-foreground">{t("asNeededNote")}</p>
            ) : (
              <div className="flex flex-col gap-1">
                <Field id={`ends_${i}`} type="date" label={t("lastDay")} value={r.endsOn} onChange={(v) => update(i, { endsOn: v })} />
                <p className="text-xs text-muted-foreground">{t("lastDayNote")}</p>
              </div>
            )}
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
                {r.quantity} · {r.asNeeded ? t("asNeeded") : r.meals.map((k) => CHILD_MEALS[lang][k]).join(", ")} · {CHILD_FOOD[lang][r.food]}
              </p>
              {!r.asNeeded && r.endsOn ? <p className="text-sm">{t("until", { d: shortDate(r.endsOn, lang) })}</p> : null}
              <p className="text-xs text-muted-foreground">
                {t("forWord")}: {r.purposeText || t("noPurpose")}
                {r.purposeText && !r.purposeChanged && r.source === "suggested" ? ` (${t("suggested")})` : ""}
                {r.purposeText && !r.purposeChanged && r.source === "prescription" ? ` (${t("fromRx")})` : ""}
              </p>
              {dupNote(i)}
            </div>
            <Button variant="outline" size="sm" className="rounded-lg" onClick={() => update(i, { editing: true })}>
              {t("edit")}
            </Button>
          </div>
        ),
      )}

      {others.length ? (
        <div className="flex flex-col gap-3 rounded-2xl bg-card p-4">
          <div>
            <p className="font-bold">{t("ongoingAskTitle")}</p>
            <p className="text-sm text-muted-foreground">{t("ongoingAskSub")}</p>
          </div>
          {others.map((m) => (
            <div key={m.id} className="flex flex-col gap-2 border-t pt-3">
              <div>
                <p className="font-mono font-medium">{`${m.name} ${m.strength}`.trim()}</p>
                <p className="text-xs text-muted-foreground">{m.asNeeded ? t("asNeeded") : m.meals.map((k) => CHILD_MEALS[lang][k]).join(", ")}</p>
              </div>
              <div className="flex gap-2">
                <Toggle on={keep[m.id!] === true} onClick={() => setKeep({ ...keep, [m.id!]: true })}>
                  {t("stillTaking")}
                </Toggle>
                <Toggle on={keep[m.id!] === false} onClick={() => setKeep({ ...keep, [m.id!]: false })}>
                  {t("stopIt")}
                </Toggle>
              </div>
            </div>
          ))}
        </div>
      ) : null}

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

/** "Already on Amma's list" or "Appears twice": shown to the child, never blocks approving. */
function DuplicateNote({ flag, lang, t }: { flag: DuplicateFlag<Medicine>; lang: ChildLang; t: ReturnType<typeof makeT> }) {
  if (!flag.onList && !flag.twiceInList) return null;
  const m = flag.onList;
  return (
    <div role="note" className="mt-2 rounded-xl bg-warn-soft px-3 py-2 text-sm">
      {m ? (
        <p className="font-bold text-warn">
          {t("dupOnList")}: {`${m.name} ${m.strength}`.trim()}, {m.meals.map((k) => CHILD_MEALS[lang][k]).join(", ")}
        </p>
      ) : null}
      {flag.twiceInList ? <p className="font-bold text-warn">{t("dupInList")}</p> : null}
      <p className="text-muted-foreground">{t("dupNote")}</p>
    </div>
  );
}

function Field({ id, label, value, onChange, type = "text" }: { id: string; label: string; value: string; onChange: (v: string) => void; type?: "text" | "date" }) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Input id={id} type={type} className="h-11 text-base" value={value} onChange={(e) => onChange(e.target.value)} />
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
