import { ArrowDownRight, ArrowRight, ArrowUpRight, Bell, Camera, ChevronDown, ChevronRight, FileText, House, MessageCircle, Pill as PillIcon, Settings, Siren } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { dismissAlert } from "@/app/actions";
import { Card, CardHead, FlagPill, MonthGrid, Pill, RangeBar, Ring, WeekBars } from "@/components/app/dashboard";
import { CopyButton } from "@/components/app/copy-button";
import { IlloPanel, RxIllo } from "@/components/app/illustrations";
import { ParentPhoneForm } from "@/components/app/parent-phone-form";
import { SettingsForm } from "@/components/app/settings-form";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { VisitCard } from "@/components/app/visit-card";
import { buttonVariants } from "@/components/ui/button";
import { type DoseRow, lastDays, monthToDate, shiftDate, totals } from "@/lib/domain/adherence";
import { formatTime, istNow } from "@/lib/domain/meals";
import { groupByTest, outsideCount, type TestTrend } from "@/lib/domain/trends";
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
type Prescription = { id: string; source: "parent" | "child"; status: "pending" | "approved" | "rejected"; doctor: string | null; rx_date: string | null; created_at: string };
type Message = { id: string; direction: "in" | "out"; body: string; created_at: string };
type Alert = { id: string; kind: string; severity: "check" | "urgent"; detail: { text?: string } | null; created_at: string; seen_at?: string | null };

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
  // Render only for the real request: the login check and today's date both read the current time.
  await connection();
  const { supabase, family } = await requireFamily();
  const sp = await searchParams;
  const tab: Tab = TABS.includes(sp.tab as Tab) ? (sp.tab as Tab) : "home";
  const range = sp.range === "month" ? "month" : "week";
  const view = sp.view === "date" ? "date" : "test";
  const lang = family.child_lang;
  const t = makeT(lang, { n: family.parent_call_name });
  const { date: today } = istNow();

  const [medsRes, pendingRes, dosesRes, reportsRes, msgsRes, alertsRes, visitsRes, rxRes, allMedsRes] = await Promise.all([
    supabase.from("medicines").select("*").eq("family_id", family.id).eq("active", true).order("created_at"),
    supabase.from("prescriptions").select("id", { count: "exact", head: true }).eq("family_id", family.id).eq("status", "pending"),
    supabase.from("doses").select("dose_date,meal,status").eq("family_id", family.id).gte("dose_date", shiftDate(today, -35)),
    supabase.from("reports").select("id,lab,report_date,created_at,report_values(*)").eq("family_id", family.id).order("created_at", { ascending: false }).limit(50),
    supabase.from("messages").select("id,direction,body,created_at").eq("family_id", family.id).order("created_at", { ascending: false }).limit(60),
    supabase.from("alerts").select("*").eq("family_id", family.id).order("created_at", { ascending: false }).limit(30),
    supabase.from("visits").select("*").eq("family_id", family.id).gte("visit_date", today).order("visit_date"),
    supabase.from("prescriptions").select("id,source,status,doctor,rx_date,created_at").eq("family_id", family.id).order("created_at"),
    supabase.from("medicines").select("*").eq("family_id", family.id).order("created_at"),
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
  const prescriptions = (rxRes.data ?? []) as Prescription[];
  const allMeds = (allMedsRes.data ?? []) as MedicineRow[];
  const times = mealTimes(family);
  const mealsWithMeds = MEALS.filter((k) => meds.some((m) => m.meals.includes(k)));
  const todayDoses = doses.filter((d) => d.dose_date === today);
  const statusOf = (k: MealKey) => todayDoses.find((d) => d.meal === k)?.status ?? "upcoming";
  const nextMeal = mealsWithMeds.find((k) => statusOf(k) === "upcoming");
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
  ) : !meds.length ? (
    <Pill tone="warn">{t("waitingList")}</Pill>
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
        <ThemeToggle label={t("themeToggle")} />
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
              <>
                {/* Day one: nothing to remind yet. One clear next step, unless a list is already waiting for the child's check. */}
                {!pending && (
                  <Card className="items-center gap-3 text-center">
                    <IlloPanel className="h-32 w-full rounded-2xl">
                      <RxIllo />
                    </IlloPanel>
                    <h2 className="text-xl font-bold">{t("emptyTitle")}</h2>
                    <p className="text-[15px] leading-relaxed text-muted-foreground">{t("emptyBody")}</p>
                    <Link href="/add" className={cn(buttonVariants({ size: "lg" }), "h-12 w-full gap-2 rounded-2xl text-base font-bold")}>
                      <Camera className="size-5" aria-hidden />
                      {t("addPhoto")}
                    </Link>
                  </Card>
                )}
                <Card>
                  <CardHead title={t("today")} />
                  <p className="text-sm text-muted-foreground">{t("todayEmpty")}</p>
                </Card>
              </>
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
                            <p className="min-w-0 flex-1 font-bold">{CHILD_MEALS[lang][k]}</p>
                            {st === "taken" ? (
                              <Pill tone="ok">{t("taken")}</Pill>
                            ) : st === "missed" ? (
                              <Pill tone="bad">{t("notMarked")}</Pill>
                            ) : st === "sent" ? (
                              <Pill tone="mute">{t("sentWaiting")}</Pill>
                            ) : k === nextMeal ? (
                              <Pill tone="mute">
                                {t("nextDose")} · {formatTime(times[k])}
                              </Pill>
                            ) : (
                              <Pill tone="mute">{formatTime(times[k])}</Pill>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </Card>

                <Adherence doses={doses} today={today} range={range} t={t} />

                <Card>
                  <CardHead
                    title={t("ongoingTitle")}
                    right={
                      <Link href="/home?tab=meds" className="text-sm font-bold text-primary">
                        {t("viewAll")}
                      </Link>
                    }
                  />
                  <p className="text-sm text-muted-foreground">{t("medsPerDay", { a: meds.length, b: dosesPerDay(meds) })}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {meds.map((m) => (
                      <span key={m.id} className="rounded-full bg-brand-soft px-2.5 py-1 font-mono text-xs text-primary">
                        {`${m.name} ${m.strength}`.trim()}
                      </span>
                    ))}
                  </div>
                </Card>
              </>
            )}

            <VisitCard visits={visits} today={today} lang={lang} t={t} failed={sp.visit === "failed"} />

            {reports[0] && <ReportLine report={reports[0]} t={t} />}
          </>
        )}

        {tab === "meds" && (
          <>
            {meds.length ? (
              <div className="flex items-baseline justify-between gap-2 px-1">
                <h2 className="font-heading text-lg font-bold">{t("ongoingTitle")}</h2>
                <span className="text-xs text-muted-foreground">{t("medsPerDay", { a: meds.length, b: dosesPerDay(meds) })}</span>
              </div>
            ) : null}
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
            <RxHistory prescriptions={prescriptions} medicines={allMeds} t={t} lang={lang} />
          </>
        )}

        {tab === "reports" &&
          (reports.length ? (
            <>
              <div className="flex rounded-xl bg-muted p-0.5">
                {(["test", "date"] as const).map((v) => (
                  <Link
                    key={v}
                    href={`/home?tab=reports&view=${v}`}
                    className={`flex-1 rounded-lg px-2.5 py-1.5 text-center text-sm ${view === v ? "bg-card font-bold" : "text-muted-foreground"}`}
                    aria-current={view === v ? "true" : undefined}
                  >
                    {v === "test" ? t("byTest") : t("byDate")}
                  </Link>
                ))}
              </div>
              {view === "test" ? (
                <Card className="gap-0">
                  <div className="divide-y">
                    {groupByTest(reports).map((tr) => (
                      <TestRow key={tr.key} trend={tr} t={t} lang={lang} flagLabels={flagLabels} />
                    ))}
                  </div>
                  <p className="pt-2 text-xs text-muted-foreground">{t("analysisOnly")}</p>
                </Card>
              ) : (
                reports.map((r) => <ReportFold key={r.id} report={r} t={t} lang={lang} flagLabels={flagLabels} />)
              )}
            </>
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
                    {new Date(a.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}
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
            <SettingsForm lang={lang} callName={family.parent_call_name} meals={times} childLang={family.child_lang} parentLang={family.parent_lang} />
            <ParentPhoneForm lang={lang} callName={family.parent_call_name} parentPhone={family.parent_phone} />
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

type FlagLabels = { high: string; low: string; inRange: string; noRange: string };

/** The date printed on the report, or the day it was sent. */
function reportDate(report: Report): string {
  return report.report_date ?? new Date(report.created_at).toLocaleDateString("en-IN");
}

/** How many results are outside the printed range, or "In range" when every readable result is inside it. */
function ReportPill({ report, t }: { report: Report; t: ReturnType<typeof makeT> }) {
  const outside = outsideCount(report.values);
  if (outside) return <Pill tone="warn">{t("outsideRange", { a: outside })}</Pill>;
  return report.values.some((v) => v.flag === "in_range") ? <Pill tone="ok">{t("inRange")}</Pill> : null;
}

/** The latest report as one line on Home: its date and how many results are outside the printed range. The full report is in the Reports tab. */
function ReportLine({ report, t }: { report: Report; t: ReturnType<typeof makeT> }) {
  return (
    <Link href="/home?tab=reports" className="flex items-center gap-3 rounded-2xl bg-card p-4">
      <FileText className="size-5 shrink-0 text-primary" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="font-heading font-bold">{t("latestReport")}</span> <span className="text-xs text-muted-foreground">· {reportDate(report)}</span>
      </span>
      <ReportPill report={report} t={t} />
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}

/** One result: value, range bar, printed range and what the test measures. */
function ValueDetail({ v, lang }: { v: ReportValue; lang: "en" | "hi" }) {
  return (
    <>
      <RangeBar v={v} />
      {v.rangeText ? <p className="font-mono text-[11px] text-muted-foreground">{v.rangeText}</p> : null}
      {v.whatItMeasures ? <p className="text-xs whitespace-pre-line text-muted-foreground">{v.whatItMeasures[lang]}</p> : null}
    </>
  );
}

const SUMMARY = "flex cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden";

/** One test across all reports: latest value, its flag, earlier values and which way it moved. Tap for the range and meaning. */
function TestRow({ trend, t, lang, flagLabels }: { trend: TestTrend; t: ReturnType<typeof makeT>; lang: "en" | "hi"; flagLabels: FlagLabels }) {
  const { latest, points, direction } = trend;
  const shown = points.slice(-4).map((p) => (p.valueNumber ?? p.valueText).toString());
  const Arrow = direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : direction === "same" ? ArrowRight : null;
  const moved = direction === "up" ? t("higherThanLast") : direction === "down" ? t("lowerThanLast") : t("sameAsLast");
  return (
    <details className="group py-2.5">
      <summary className={SUMMARY}>
        <span className="min-w-0 flex-1">
          <span className="block">{latest.test}</span>
          <span className="block font-mono text-xs text-muted-foreground">
            {points.length > 1 ? `${points.length > 4 ? "... " : ""}${shown.join(" → ")} · ${t("reportsCount", { a: points.length })}` : t("onlyOneReport")}
          </span>
        </span>
        <span className="font-mono text-sm">{latest.valueText}</span>
        {Arrow ? <Arrow className="size-4 shrink-0 text-muted-foreground" aria-label={moved} /> : null}
        <FlagPill flag={latest.flag} labels={flagLabels} />
      </summary>
      <div className="mt-2 flex flex-col gap-1">
        <ValueDetail v={latest} lang={lang} />
      </div>
    </details>
  );
}

/** One report, folded to its date, lab and outside-range count. Tap to see every result. */
function ReportFold({ report, t, lang, flagLabels }: { report: Report; t: ReturnType<typeof makeT>; lang: "en" | "hi"; flagLabels: FlagLabels }) {
  return (
    <details className="group rounded-2xl bg-card p-4">
      <summary className={cn(SUMMARY, "gap-3")}>
        <FileText className="size-5 shrink-0 text-primary" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="font-heading font-bold">{reportDate(report)}</span>
          {report.lab ? <span className="text-xs text-muted-foreground"> · {report.lab}</span> : null}
        </span>
        <ReportPill report={report} t={t} />
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="mt-2 flex flex-col">
        {report.values.map((v, i) => (
          <div key={i} className="flex flex-col gap-1 border-b py-2 last:border-0">
            <div className="flex items-center justify-between gap-2">
              <span>{v.test}</span>
              <FlagPill flag={v.flag} labels={flagLabels} />
            </div>
            <p className="font-mono text-lg">{v.valueText}</p>
            <ValueDetail v={v} lang={lang} />
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{t("analysisOnly")}</p>
    </details>
  );
}

/** Every dose in a day: one per medicine per meal. */
function dosesPerDay(meds: Medicine[]): number {
  return meds.reduce((n, m) => n + m.meals.length, 0);
}

function when(iso: string, lang: "en" | "hi"): string {
  return new Date(iso).toLocaleString(lang === "hi" ? "hi-IN" : "en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

/**
 * Every prescription since the first, newest on top and folded, with the medicines it added and
 * whether each is ongoing or stopped. Medicines the child added by hand get their own card.
 */
function RxHistory({ prescriptions, medicines, t, lang }: { prescriptions: Prescription[]; medicines: MedicineRow[]; t: ReturnType<typeof makeT>; lang: "en" | "hi" }) {
  const byHand = medicines.filter((m) => !m.prescription_id);
  if (!prescriptions.length && !byHand.length) return null;
  const numbered = prescriptions.map((rx, i) => ({ rx, n: i + 1 })).reverse();

  const medLine = (m: MedicineRow, approved: boolean) => (
    <div key={m.id} className="flex items-center gap-2 border-b py-2 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="font-mono text-sm font-medium">{`${m.name} ${m.strength}`.trim()}</p>
        <p className="text-xs text-muted-foreground">{toMedicine(m).meals.map((k) => CHILD_MEALS[lang][k]).join(", ")}</p>
      </div>
      {m.active ? (
        <Pill tone="ok">{t("ongoingPill")}</Pill>
      ) : m.stopped_at ? (
        <Pill tone="mute">{t("stoppedOn", { d: new Date(m.stopped_at).toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" }) })}</Pill>
      ) : approved ? (
        <Pill tone="mute">{t("stoppedPill")}</Pill>
      ) : null}
    </div>
  );

  return (
    <>
      <h2 className="px-1 pt-2 font-heading text-lg font-bold">{t("rxHistory")}</h2>
      {numbered.map(({ rx, n }, i) => {
        const meds = medicines.filter((m) => m.prescription_id === rx.id);
        return (
          <details key={rx.id} open={i === 0} className="group rounded-2xl bg-card p-4">
            <summary className={cn(SUMMARY, "gap-3")}>
              <FileText className="size-5 shrink-0 text-primary" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block font-heading font-bold">{t("rxN", { a: n })}</span>
                <span className="block text-xs text-muted-foreground">
                  {when(rx.created_at, lang)} · {rx.source === "parent" ? t("rxFromParent") : t("rxFromChild")}
                </span>
              </span>
              {rx.status === "pending" ? <Pill tone="warn">{t("waitingCheck")}</Pill> : rx.status === "rejected" ? <Pill tone="mute">{t("notApproved")}</Pill> : null}
              <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            {rx.doctor || rx.rx_date ? (
              <p className="mt-2 text-xs text-muted-foreground">{[rx.doctor, rx.rx_date ? t("rxWritten", { d: rx.rx_date }) : null].filter(Boolean).join(" · ")}</p>
            ) : null}
            <div className="mt-1 flex flex-col">{meds.map((m) => medLine(m, rx.status === "approved"))}</div>
          </details>
        );
      })}
      {byHand.length ? (
        <details className="group rounded-2xl bg-card p-4">
          <summary className={cn(SUMMARY, "gap-3")}>
            <PillIcon className="size-5 shrink-0 text-primary" aria-hidden />
            <span className="min-w-0 flex-1 font-heading font-bold">{t("addedByYou")}</span>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <div className="mt-1 flex flex-col">{byHand.map((m) => medLine(m, true))}</div>
        </details>
      ) : null}
    </>
  );
}
