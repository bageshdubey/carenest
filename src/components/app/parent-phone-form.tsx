"use client";

import { useActionState } from "react";
import { changeParentPhone } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ChildLang } from "@/lib/domain/types";
import { makeT } from "@/lib/i18n/child";

/** Changes the parent's WhatsApp number, after a warning that the old number is disconnected. */
export function ParentPhoneForm({ lang, callName, parentPhone }: { lang: ChildLang; callName: string; parentPhone: string }) {
  const t = makeT(lang, { n: callName });
  const [state, action, pending] = useActionState(changeParentPhone, null);
  const error = state && !state.ok ? (state.error === "phoneTaken" ? t("phoneTaken") : state.error === "phone" ? t("numErr") : t("saveErr")) : "";

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(t("changeNumConfirm"))) e.preventDefault();
      }}
      className="flex flex-col gap-3 rounded-2xl bg-card p-4"
    >
      <Label htmlFor="parent_phone" className="font-heading text-base font-bold">
        {t("changeNum")}
      </Label>
      <div className="flex items-center gap-2">
        <span className="rounded-lg border bg-background px-3 py-2.5 font-mono">+91</span>
        <Input id="parent_phone" name="parent_phone" inputMode="numeric" autoComplete="off" defaultValue={parentPhone.replace(/^91/, "")} className="h-11 text-base" />
      </div>
      <p className="rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn">{t("changeNumWarn")}</p>
      {error ? (
        <p role="alert" className="text-sm text-bad">
          {error}
        </p>
      ) : null}
      <Button type="submit" variant="outline" size="lg" className="h-12 rounded-xl" disabled={pending}>
        {t("changeNumBtn")}
      </Button>
    </form>
  );
}
