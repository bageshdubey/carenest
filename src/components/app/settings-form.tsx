"use client";

import { useActionState, useState } from "react";
import { updateSettings } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { ChildLang, MealKey, ParentLang } from "@/lib/domain/types";
import { CHILD_MEALS, makeT } from "@/lib/i18n/child";

export function SettingsForm({
  lang,
  callName,
  meals,
  childLang,
  parentLang,
}: {
  lang: ChildLang;
  callName: string;
  meals: Record<MealKey, string>;
  childLang: ChildLang;
  parentLang: ParentLang;
}) {
  const t = makeT(lang, { n: callName });
  const [state, action, pending] = useActionState(updateSettings, null);
  const error = state && !state.ok ? (state.error === "meals" ? t("mealOrderErr") : t("saveErr")) : "";
  // Save turns green only when something differs from what is saved. After saving, the page
  // reloads with the new values, so it goes grey again.
  const saved: Record<string, string> = { meal_b: meals.b, meal_l: meals.l, meal_d: meals.d, child_lang: childLang, parent_lang: parentLang };
  const [current, setCurrent] = useState(saved);
  const changed = Object.keys(saved).some((k) => current[k] !== saved[k]);

  return (
    <form
      action={action}
      className="flex flex-col gap-3"
      onChange={(e) => setCurrent(Object.fromEntries([...new FormData(e.currentTarget)].map(([k, v]) => [k, String(v)])))}
    >
      <section className="rounded-2xl bg-card px-4 py-2">
        <h2 className="pt-2 font-heading font-bold">{t("settingsMeals")}</h2>
        {(["b", "l", "d"] as MealKey[]).map((k) => (
          <div key={k} className="flex items-center justify-between border-b py-3 last:border-0">
            <Label htmlFor={`meal_${k}`}>{CHILD_MEALS[lang][k]}</Label>
            <input id={`meal_${k}`} name={`meal_${k}`} type="time" defaultValue={meals[k]} className="rounded-lg border bg-background px-2 py-1.5 font-mono" />
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3 rounded-2xl bg-card p-4">
        <h2 className="font-heading font-bold">{t("settingsLang")}</h2>
        <div className="flex flex-col gap-1">
          <Label htmlFor="child_lang">{t("langYou")}</Label>
          <select id="child_lang" name="child_lang" defaultValue={childLang} className="h-11 rounded-lg border bg-background px-3">
            <option value="en">English</option>
            <option value="hi">हिंदी (Hindi)</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="parent_lang">{t("langParent")}</Label>
          <select id="parent_lang" name="parent_lang" defaultValue={parentLang} className="h-11 rounded-lg border bg-background px-3">
            <option value="en">English</option>
            <option value="hi">हिंदी (Hindi)</option>
            <option value="mr">मराठी (Marathi)</option>
          </select>
        </div>
      </section>

      {error ? (
        <p role="alert" className="text-sm text-bad">
          {error}
        </p>
      ) : null}
      {state?.ok && !changed ? <p className="rounded-xl bg-ok-soft px-3 py-2 text-sm text-ok">{t("saved")}</p> : null}
      <Button type="submit" size="lg" variant={changed ? "default" : "secondary"} className="h-12 rounded-xl text-base font-bold" disabled={!changed || pending}>
        {t("save")}
      </Button>
    </form>
  );
}
