import { confirmVisit, removeVisit, saveVisit } from "@/app/actions";
import { Card, CardHead } from "@/components/app/dashboard";
import { buttonVariants } from "@/components/ui/button";
import type { VisitRow } from "@/lib/db/rows";
import { formatTime } from "@/lib/domain/meals";
import type { ChildLang } from "@/lib/domain/types";
import type { makeT } from "@/lib/i18n/child";
import { cn } from "@/lib/utils";

type T = ReturnType<typeof makeT>;

function when(lang: ChildLang, v: VisitRow): string {
  const d = new Date(`${v.visit_date}T00:00:00Z`).toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  return [d, v.visit_time ? formatTime(v.visit_time) : null, v.doctor].filter(Boolean).join(" · ");
}

const small = cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-lg");

function IdButton({ action, id, label, primary = false }: { action: (f: FormData) => Promise<void>; id: string; label: string; primary?: boolean }) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" className={primary ? cn(buttonVariants({ size: "sm" }), "rounded-lg") : small}>
        {label}
      </button>
    </form>
  );
}

/** Add, change, confirm or remove the next doctor visit. A date read from a photo waits here for the child's check. */
export function VisitCard({ visits, today, lang, t }: { visits: VisitRow[]; today: string; lang: ChildLang; t: T }) {
  const confirmed = visits.find((v) => v.status === "confirmed");
  const found = visits.find((v) => v.status === "pending");

  return (
    <Card>
      <CardHead title={t("nextVisitTitle")} />
      {found && (
        <div className="flex flex-col gap-2 rounded-xl bg-warn-soft px-3 py-2.5 text-sm text-warn">
          <span>{t("visitFound", { d: when(lang, found) })}</span>
          <div className="flex gap-2">
            <IdButton action={confirmVisit} id={found.id} label={t("visitConfirm")} primary />
            <IdButton action={removeVisit} id={found.id} label={t("visitRemove")} />
          </div>
        </div>
      )}
      {confirmed ? (
        <>
          <p className="font-heading text-lg font-bold">{when(lang, confirmed)}</p>
          <p className="text-xs text-muted-foreground">{t("visitReminds")}</p>
        </>
      ) : (
        !found && <p className="text-sm text-muted-foreground">{t("visitNone")}</p>
      )}
      <details className="group">
        <summary className={cn(small, "w-fit cursor-pointer list-none")}>{confirmed ? t("visitChange") : t("visitAdd")}</summary>
        <form action={saveVisit} className="mt-3 flex flex-col gap-2 text-sm">
          <label className="flex items-center justify-between gap-3">
            {t("visitDateLabel")}
            <input name="date" type="date" required min={today} defaultValue={confirmed?.visit_date} className="rounded-lg border bg-background px-2 py-1.5" />
          </label>
          <label className="flex items-center justify-between gap-3">
            {t("visitTimeLabel")}
            <input name="time" type="time" defaultValue={confirmed?.visit_time ?? ""} className="rounded-lg border bg-background px-2 py-1.5 font-mono" />
          </label>
          <label className="flex items-center justify-between gap-3">
            {t("visitDoctorLabel")}
            <input name="doctor" type="text" maxLength={80} defaultValue={confirmed?.doctor ?? ""} className="min-w-0 flex-1 rounded-lg border bg-background px-2 py-1.5" />
          </label>
          <button type="submit" className={cn(buttonVariants({ size: "sm" }), "self-end rounded-lg")}>
            {t("visitSave")}
          </button>
        </form>
      </details>
      {confirmed && (
        <div className="self-start">
          <IdButton action={removeVisit} id={confirmed.id} label={t("visitRemove")} />
        </div>
      )}
    </Card>
  );
}
