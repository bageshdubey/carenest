import { ArrowDown, ArrowUp, Check, Minus } from "lucide-react";
import type { DayStat } from "@/lib/domain/adherence";
import type { ReportValue } from "@/lib/domain/types";

/** Small building blocks for the child's dashboard. Server components. */

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`flex flex-col gap-2 rounded-2xl bg-card p-4 ${className}`}>{children}</section>;
}

export function CardHead({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h2 className="font-heading text-base font-bold">{title}</h2>
      {right}
    </div>
  );
}

export function Pill({ tone, children }: { tone: "ok" | "warn" | "bad" | "mute"; children: React.ReactNode }) {
  const cls = {
    ok: "bg-ok-soft text-ok",
    warn: "bg-warn-soft text-warn",
    bad: "bg-bad-soft text-bad",
    mute: "bg-muted text-muted-foreground",
  }[tone];
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap ${cls}`}>{children}</span>;
}

export function Ring({ done, total }: { done: number; total: number }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const f = total ? done / total : 0;
  return (
    <svg width="76" height="76" viewBox="0 0 76 76" role="img" aria-label={`${done} of ${total}`} className="shrink-0">
      <circle cx="38" cy="38" r={r} fill="none" stroke="var(--border)" strokeWidth="8" />
      <circle cx="38" cy="38" r={r} fill="none" stroke="var(--ok)" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${c * f} ${c}`} transform="rotate(-90 38 38)" />
      <text x="38" y="43" textAnchor="middle" fontSize="17" fontWeight="700" fill="var(--foreground)" fontFamily="var(--font-plex-mono), monospace">
        {done}/{total}
      </text>
    </svg>
  );
}

const STATE_BG: Record<DayStat["state"], string> = {
  ok: "bg-ok",
  warn: "bg-warn",
  bad: "bg-bad",
  open: "bg-primary/50",
  none: "bg-border",
};

export function WeekBars({ days, labels, today }: { days: DayStat[]; labels: string[]; today: string }) {
  return (
    <div className="grid h-28 grid-cols-7 gap-2">
      {days.map((d) => {
        const total = d.taken + d.missed + d.open;
        const h = total ? Math.max(10, (d.taken / total) * 100) : 10;
        const dow = (new Date(`${d.date}T00:00:00Z`).getUTCDay() + 6) % 7;
        return (
          <div key={d.date} className="flex flex-col items-center gap-1">
            <div className="flex w-full max-w-7 flex-1 items-end overflow-hidden rounded-lg bg-muted">
              <div className={`w-full rounded-lg ${STATE_BG[d.state]}`} style={{ height: `${h}%` }} />
            </div>
            <span className={`text-xs ${d.date === today ? "font-bold" : "text-muted-foreground"}`}>{labels[dow]}</span>
          </div>
        );
      })}
    </div>
  );
}

const CELL: Record<DayStat["state"], string> = {
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
  open: "bg-brand-soft text-primary",
  none: "text-muted-foreground",
};

export function MonthGrid({ days, labels, today, daysInMonth }: { days: DayStat[]; labels: string[]; today: string; daysInMonth: number }) {
  const first = new Date(`${today.slice(0, 8)}01T00:00:00Z`);
  const offset = (first.getUTCDay() + 6) % 7;
  return (
    <div className="grid grid-cols-7 gap-1 text-center text-xs">
      {labels.map((w, i) => (
        <span key={`h${i}`} className="text-muted-foreground">
          {w}
        </span>
      ))}
      {Array.from({ length: offset }, (_, i) => (
        <span key={`o${i}`} />
      ))}
      {Array.from({ length: daysInMonth }, (_, i) => {
        const d = days[i];
        const cls = d ? CELL[d.state] : "text-muted-foreground/60";
        const isToday = d?.date === today;
        return (
          <span key={i} className={`rounded-lg py-1.5 font-mono tabular-nums ${cls} ${isToday ? "ring-2 ring-primary" : ""}`}>
            {i + 1}
          </span>
        );
      })}
    </div>
  );
}

export function RangeBar({ v }: { v: ReportValue }) {
  if (v.valueNumber === null || (v.rangeLow === null && v.rangeHigh === null)) return null;
  const lo = v.rangeLow ?? 0;
  const hi = v.rangeHigh ?? lo * 2;
  const span = Math.max(hi - lo, 1e-6);
  const min = lo - span * 0.6;
  const max = hi + span * 0.9;
  const pos = (x: number) => Math.min(98, Math.max(2, ((x - min) / (max - min)) * 100));
  const out = v.flag === "high" || v.flag === "low";
  return (
    <div className="relative mt-1 h-2.5 rounded-full bg-muted" aria-hidden="true">
      <div className="absolute inset-y-0 rounded-full border border-ok bg-ok-soft" style={{ left: `${pos(lo)}%`, width: `${pos(hi) - pos(lo)}%` }} />
      <div className={`absolute -top-1 h-[18px] w-1 -translate-x-1/2 rounded ${out ? "bg-warn" : "bg-foreground"}`} style={{ left: `${pos(v.valueNumber)}%` }} />
    </div>
  );
}

export function FlagPill({ flag, labels }: { flag: ReportValue["flag"]; labels: { high: string; low: string; inRange: string; noRange: string } }) {
  if (flag === "high")
    return (
      <Pill tone="warn">
        <ArrowUp className="size-3.5" aria-hidden /> {labels.high}
      </Pill>
    );
  if (flag === "low")
    return (
      <Pill tone="warn">
        <ArrowDown className="size-3.5" aria-hidden /> {labels.low}
      </Pill>
    );
  if (flag === "in_range")
    return (
      <Pill tone="ok">
        <Check className="size-3.5" aria-hidden /> {labels.inRange}
      </Pill>
    );
  return (
    <Pill tone="mute">
      <Minus className="size-3.5" aria-hidden /> {labels.noRange}
    </Pill>
  );
}
