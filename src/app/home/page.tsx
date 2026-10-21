import { Bell, FileText, House, MessageCircle, Pill as PillIcon, Settings, Siren } from "lucide-react";
import Link from "next/link";
import { dismissAlert } from "@/app/actions";
import { Card, CardHead, FlagPill, MonthGrid, Pill, RangeBar, Ring, WeekBars } from "@/components/app/dashboard";
import { CopyButton } from "@/components/app/copy-button";
import { SettingsForm } from "@/components/app/settings-form";
import { VisitCard } from "@/components/app/visit-card";
import { buttonVariants } from "@/components/ui/button";
import { type DoseRow, lastDays, monthToDate, shiftDate, totals } from "@/lib/domain/adherence";
import { formatTime, istNow } from "@/lib/domain/meals";
import { type MealKey, MEALS, type Medicine, type ReportValue } from "@/lib/domain/types";
import { type MedicineRow, type ReportValueRow, type VisitRow, mealTimes, toMedicine, toReportValue } from "@/lib/db/rows";
import { CHILD_FOOD, CHILD_MEALS, makeT } from "@/lib/i18n/child";
import { requireFamily } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

// Every page reads the login session, so it renders on the server per request.
export const instant = false;

const TABS = ["home", "meds", "reports", "chat", "settings", "alerts"] as const;
type Tab = (typeof TABS)[number];

type Report = { id: string; lab: string | null; report_date: string | null; created_at: string; values: ReportValue[] };
type Message = { id: string; direction: "in" | "out"; body: string; created_at: string };
type Alert = { id: string; kind: string; severity: "check" | "urgent"; detail: { text?: string } | null; sent_to_whatsapp: boolean; created_at: string; seen_at?: string | null };

/** Alert text as written for WhatsApp, without the "CareNest:" prefix or the link back to this app. */
function alertText(a: Alert): string {
  const text = (a.detail?.text ?? "")
    .replace(/^CareNest( URGENT| तुरंत)?: /, "")
    .replace(/:?\s*https?:\/\/\S+/g, "")
    .trim();
  return !text || /[.!?।]$/.test(text) ? text : `${text}.`;
}

/** "Got it": marks the alert seen so it leaves Home and the bell. */
function GotIt({ id, label }: { id: string; label: string }) {
  return (
    <form action={dismissAlert}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-7 rounded-lg px-2.5 text-xs")}>
        {label}
      </button>
    </form>
  );
}

export default async function HomePage({ searchParams }: PageProps<"/home">) {
  const { supabase, family } = await requireFamily();
  const sp = await searchParams;
  const tab: Tab = TABS.includes(sp.tab as Tab) ? (sp.tab as Tab) : "home";
  const range = sp.range === "month" ? "month" : "week";
  const lang = family.child_lang;
  const t = makeT(lang, { n: family.parent_call_name });
  const { date: today } = istNow();

  const [medsRes, pendingRes, dosesRes, reportsRes, msgsRes, alertsRes, visitsRes] = await Promise.all([
    supabase.from("medicines").select("*").eq("family_id", family.id).eq("active", true).order("created_at"),
    supabase.from("prescriptions").select("id", { count: "exact", head: true }).eq("family_id", family.id).eq("status", "pending"),
    supabase.from("doses").select("dose_date,meal,status").eq("family_id", family.id).gte("dose_date", shiftDate(today, -35)),
    supabase.from("reports").select("id,lab,report_date,created_at,report_values(*)").eq("family_id", family.id).order("created_at", { ascending: false }).limit(5),
    supabase.from("messages").select("id,direction,body,created_at").eq("family_id", family.id).order("created_at", { ascending: false }).limit(60),
    supabase.from("alerts").select("*").eq("family_id", family.id).order("created_at", { ascending: false }).limit(30),
    supabase.from("visits").select("*").eq("family_id", family.id).gte("visit_date", today).order("visit_date"),
  ]);

  const meds: Medicine[] = ((medsRes.data ?? []) as MedicineRow[]).map(toMedicine);
  const pending = (pendingRes.count ?? 0) > 0;
  const doses = (dosesRes.data ?? []) as DoseRow[];
  const reports: Report[] = ((reportsRes.data ?? []) as (Omit<Report, "values"> & { report_values: ReportValueRow[] })[]).map((r) => ({
    ...r,
    values: r.report_values.map(toReportValue),
  }));
  const messages = ((msgsRes.data ?? []) as Message[]).reverse();
  const alerts = (alertsRes.data ?? []) as Alert[];
  const visits = (visitsRes.data ?? []) as VisitRow[];
  const times = mealTimes(family);
  const mealsWithMeds = MEALS.filter((k) => meds.some((m) => m.meals.includes(k)));
  const todayDoses = doses.filter((d) => d.dose_date === today);
  const statusOf = (k: MealKey) => todayDoses.find((d) => d.meal === k)?.status ?? "upcoming";
  const missedToday = todayDoses.some((d) => d.status === "missed");
  const unseen = alerts.filter((a) => !a.seen_at);
  // "New list" has its own Check bar while a list is pending, so it is never a Home banner.
  const homeAlerts = unseen.filter((a) => a.kind !== "new_list");
  const urgent = alerts.some((a) => a.severity === "urgent" && istNow(new Date(a.created_at)).date === today);
  const flagLabels = { high: t("high"), low: t("low"), inRange: t("inRange"), noRange: t("noRange") };

  const status = !family.parent_linked_at ? (
    <Pill tone="mute">{t("notLinked")}</Pill>
  ) : urgent || missedToday ? (
    <Pill tone="bad">{t("attention")}</Pill>
  ) : (
    <Pill tone="ok">{t("onTrack")}</Pill>
  );

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-card px-4 py-3">
        <div className="grid size-10 place-items-center rounded-full bg-brand-soft font-heading font-bold text-primary">{family.parent_call_name.slice(0, 1)}</div>
        <div className="flex min-w-0 flex-1 flex-col items-start">
          <span className="font-heading text-lg font-bold">{family.parent_call_name}</span>
          {status}
        </div>
        <Link href="/home?tab=alerts" aria-label={t("t_alerts")} className="relative grid size-10 place-items-center rounded-xl border">
          <Bell className="size-5" aria-hidden />
          {unseen.length ? <span className="absolute -top-1.5 -right-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-bad px-1 text-[11px] font-bold text-card">{unseen.length}</span> : null}
        </Link>
      </header>

      <main className="flex flex-1 flex-col gap-3 px-4 pt-4 pb-28">
        {!family.parent_linked_at && (
          <Link href="/setup" className="rounded-xl bg-warn-soft px-3 py-2.5 text-sm text-warn">
            {t("waitHi")}
          </Link>
        )}
        {pending && (
          <div className="flex items-center gap-3 rounded-xl bg-warn-soft px-3 py-2.5 text-sm text-warn">
            <span className="flex-1">{t("newList")}</span>
            <Link href="/check" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-lg")}>
              {t("check")}
            </Link>
          </div>
        )}

        {tab === "home" && (
          <>
            {homeAlerts.slice(0, 2).map((a) => (
              <div key={a.id} className={`flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm ${a.severity === "urgent" ? "bg-bad-soft text-bad" : "bg-warn-soft text-warn"}`}>
                {a.severity === "urgent" ? <Siren className="mt-0.5 size-4 shrink-0" aria-hidden /> : <Bell className="mt-0.5 size-4 shrink-0" aria-hidden />}
                <span className="flex-1">{alertText(a)}</span>
                <GotIt id={a.id} label={t("gotIt")} />
              </div>
            ))}

            {!meds.length ? (
              <Card>
                <p className="text-muted-foreground">{t("todayEmpty")}</p>
              </Card>
            ) : (
              <>
                <Card>
                  <CardHead title={t("today")} />
                  <div className="flex items-center gap-4">
                    <Ring done={mealsWithMeds.filter((k) => statusOf(k) === "taken").length} total={mealsWithMeds.length} />
                    <div className="flex min-w-0 flex-1 flex-col gap-2.5">
                      {mealsWithMeds.map((k) => {
                        const st = statusOf(k);
                        return (
                          <div key={k} className="flex items-center gap-2">
                            <span className={`size-2.5 shrink-0 rounded-full ${st === "taken" ? "bg-ok" : st === "missed" ? "bg-bad" : "bg-border"}`} />
                            <div className="min-w-0 flex-1">
                              <p className="font-bold">{CHILD_MEALS[lang][k]}</p>
                              <p className="truncate text-xs text-muted-foreground">{meds.filter((m) => m.meals.includes(k)).map((m) => m.name).join(", ")}</p>
                            </div>
                            {st === "taken" ? (
                              <Pill tone="ok">{t("taken")}</Pill>
                            ) : st === "missed" ? (
                              <Pill tone="bad">{t("notMarked")}</Pill>
                            ) : st === "sent" ? (
                              <Pill tone="mute">{t("sentWaiting")}</Pill>
                            ) : (
                              <Pill tone="mute">{formatTime(times[k])}</Pill>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </Card>

                <NextDose meds={meds} times={times} statusOf={statusOf} label={t("nextDose")} lang={lang} />

                <Adherence doses={doses} today={today} range={range} t={t} />
              </>
            )}

            <VisitCard visits={visits} today={today} lang={lang} t={t} failed={sp.visit === "failed"} />

            {reports[0] && (
              <>
                <div className="flex items-center justify-between px-1">
                  <h2 className="font-heading font-bold">{t("latestReport")}</h2>
                  <Link href="/home?tab=reports" className="text-sm font-bold text-primary">
                    {t("viewAll")}
                  </Link>
                </div>
                <ReportCard report={reports[0]} t={t} lang={lang} flagLabels={flagLabels} full={false} />
              </>
            )}

            <Card>
              <CardHead
                title={t("t_meds")}
                right={
                  <Link href="/home?tab=meds" className="text-sm font-bold text-primary">
                    {t("viewAll")}
                  </Link>
                }
              />
              <p className="text-sm text-muted-foreground">
                {t("medsCount", { a: meds.length })}
                {meds.length ? ` · ${t("approved")}` : ""}
              </p>
            </Card>
          </>
        )}

        {tab === "meds" && (
          <>
            {!meds.length ? (
              <Card>
                <p className="text-muted-foreground">{t("listEmpty")}</p>
              </Card>
            ) : (
              mealsWithMeds.map((k) => (
                <Card key={k}>
                  <CardHead title={CHILD_MEALS[lang][k]} right={<span className="font-mono text-xs text-muted-foreground">{formatTime(times[k])}</span>} />
                  {meds
                    .filter((m) => m.meals.includes(k))
                    .map((m) => (
                      <div key={`${k}-${m.id}`} className="flex items-center gap-3 py-1">
                        <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-primary">
                          <PillIcon className="size-4" aria-hidden />
                        </div>
                        <div className="min-w-0">
                          <p className="font-mono font-medium">
                            {m.name} {m.strength}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {m.quantity} · {CHILD_FOOD[lang][m.food]}
                            {m.purpose ? ` · ${m.purpose[lang]}` : ""}
                          </p>
                        </div>
                      </div>
                    ))}
                </Card>
              ))
            )}
            <div className="flex gap-2">
              {meds.length ? (
                <Link href="/check" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-12 flex-1 rounded-xl")}>
                  {t("editList")}
                </Link>
              ) : null}
              <Link href="/add" className={cn(buttonVariants({ size: "lg" }), "h-12 flex-1 rounded-xl font-bold")}>
                {t("addRx")}
              </Link>
            </div>
          </>
        )}

        {tab === "reports" &&
          (reports.length ? (
            reports.map((r) => <ReportCard key={r.id} report={r} t={t} lang={lang} flagLabels={flagLabels} full />)
          ) : (
            <Card>
              <p className="text-muted-foreground">{t("reportsEmpty")}</p>
            </Card>
          ))}

        {tab === "chat" &&
          (messages.length ? (
            <div className="flex flex-col gap-2">
              {messages.map((m) => (
                <div key={m.id} className={`max-w-[86%] rounded-2xl px-3 py-2 text-[15px] whitespace-pre-line ${m.direction === "in" ? "self-start bg-card" : "self-end bg-brand-soft"}`}>
                  <span className="block text-xs text-muted-foreground">{m.direction === "in" ? family.parent_call_name : t("helper")}</span>
                  {m.body}
                </div>
              ))}
            </div>
          ) : (
            <Card>
              <p className="text-muted-foreground">{t("chatEmpty")}</p>
            </Card>
          ))}

        {tab === "alerts" &&
          (alerts.length ? (
            alerts.map((a) => (
              <Card key={a.id} className="flex-row items-start gap-3">
                {a.severity === "urgent" ? <Siren className="mt-0.5 size-5 shrink-0 text-bad" aria-hidden /> : <Bell className="mt-0.5 size-5 shrink-0 text-warn" aria-hidden />}
                <div className="min-w-0 flex-1">
                  <p>{alertText(a)}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(a.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })} ·{" "}
                    {a.sent_to_whatsapp ? t("sentWa") : t("dashboardOnly")}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  {a.severity === "urgent" ? <Pill tone="bad">{t("urgent")}</Pill> : null}
                  {a.seen_at ? <span className="text-xs text-muted-foreground">{t("seen")}</span> : <GotIt id={a.id} label={t("gotIt")} />}
                </div>
              </Card>
            ))
          ) : (
            <Card>
              <p className="text-muted-foreground">{t("alertsEmpty")}</p>
            </Card>
          ))}

        {tab === "settings" && (
          <>
            <SettingsForm lang={lang} callName={family.parent_call_name} meals={times} childLang={family.child_lang} parentLang={family.parent_lang} childPhone={family.child_phone ?? ""} />
            <Card className="flex-row items-center gap-3">
              <span className="flex-1 text-sm">
                {t("parentNumber")}: <span className="font-mono">+{family.parent_phone}</span>
              </span>
              <CopyButton text={`+${family.parent_phone}`} label={t("callParent")} done={t("copied")} />
            </Card>
          </>
        )}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-10 border-t bg-card pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto grid max-w-md grid-cols-5">
          {(
            [
              ["home", House],
              ["meds", PillIcon],
              ["reports", FileText],
              ["chat", MessageCircle],
              ["settings", Settings],
            ] as const
          ).map(([k, Icon]) => (
            <Link key={k} href={`/home?tab=${k}`} className={`flex flex-col items-center gap-0.5 pt-2 pb-2.5 text-[11px] ${tab === k ? "font-bold text-primary" : "text-muted-foreground"}`}>
              <Icon className="size-5" aria-hidden />
              {t(`t_${k}`)}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}

function NextDose({
  meds,
  times,
  statusOf,
  label,
  lang,
}: {
  meds: Medicine[];
  times: Record<MealKey, string>;
  statusOf: (k: MealKey) => string;
  label: string;
  lang: "en" | "hi";
}) {
  const next = MEALS.find((k) => meds.some((m) => m.meals.includes(k)) && statusOf(k) === "upcoming");
  if (!next) return null;
  return (
    <Card className="gap-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-heading text-lg font-bold">
        {CHILD_MEALS[lang][next]} · {formatTime(times[next])}
      </p>
      <p className="text-sm">
        {meds
          .filter((m) => m.meals.includes(next))
          .map((m) => `${m.name} ${m.strength}`)
          .join(", ")}
      </p>
    </Card>
  );
}

function Adherence({ doses, today, range, t }: { doses: DoseRow[]; today: string; range: "week" | "month"; t: ReturnType<typeof makeT> }) {
  const days = range === "week" ? lastDays(today, 7, doses) : monthToDate(today, doses);
  const { taken, decided, pct } = totals(days);
  const wd = t("wd").split(",");
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const seg = (r: "week" | "month", label: string) => (
    <Link href={`/home?range=${r}`} className={`rounded-lg px-2.5 py-1 text-xs ${range === r ? "bg-card font-bold" : "text-muted-foreground"}`} aria-current={range === r ? "true" : undefined}>
      {label}
    </Link>
  );
  return (
    <Card>
      <CardHead
        title={t("adherence")}
        right={
          <div className="flex rounded-xl bg-muted p-0.5">
            {seg("week", t("week"))}
            {seg("month", t("month"))}
          </div>
        }
      />
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-heading text-3xl font-bold">{pct === null ? "-" : `${pct}%`}</span>
        <span className="text-xs text-muted-foreground">
          {t("ofDoses", { a: taken, b: decided })} · {range === "week" ? t("thisWeek") : t("thisMonth")}
        </span>
      </div>
      {range === "week" ? (
        <WeekBars days={days} labels={wd} today={today} />
      ) : (
        <>
          <p className="text-xs font-bold">
            {t("months").split(",")[month - 1]} {year}
          </p>
          <MonthGrid days={days} labels={wd} today={today} daysInMonth={daysInMonth} />
        </>
      )}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <i className="size-2.5 rounded-sm bg-ok" />
          {t("lgAll")}
        </span>
        <span className="inline-flex items-center gap-1">
          <i className="size-2.5 rounded-sm bg-warn" />
          {t("lgOne")}
        </span>
        <span className="inline-flex items-center gap-1">
          <i className="size-2.5 rounded-sm bg-bad" />
          {t("lgTwo")}
        </span>
        <span className="inline-flex items-center gap-1">
          <i className="size-2.5 rounded-sm bg-border" />
          {t("lgNone")}
        </span>
      </div>
    </Card>
  );
}

function ReportCard({
  report,
  t,
  lang,
  flagLabels,
  full,
}: {
  report: Report;
  t: ReturnType<typeof makeT>;
  lang: "en" | "hi";
  flagLabels: { high: string; low: string; inRange: string; noRange: string };
  full: boolean;
}) {
  return (
    <Card>
      {full && <CardHead title={[report.lab, report.report_date].filter(Boolean).join(" · ") || new Date(report.created_at).toLocaleDateString("en-IN")} />}
      {report.values.map((v, i) => (
        <div key={i} className="flex flex-col gap-1 border-b py-2 last:border-0">
          <div className="flex items-center justify-between gap-2">
            <span>{v.test}</span>
            <FlagPill flag={v.flag} labels={flagLabels} />
          </div>
          <p className="font-mono text-lg">{v.valueText}</p>
          <RangeBar v={v} />
          {v.rangeText ? <p className="font-mono text-[11px] text-muted-foreground">{v.rangeText}</p> : null}
          {full && v.whatItMeasures ? <p className="text-xs text-muted-foreground">{v.whatItMeasures[lang]}</p> : null}
        </div>
      ))}
      <p className="text-xs text-muted-foreground">{t("analysisOnly")}</p>
    </Card>
  );
}
