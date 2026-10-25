import type { ReadResult } from "@/lib/ai/gemini";
import { shiftDate } from "@/lib/domain/adherence";
import { courseEnd } from "@/lib/domain/course";
import { istNow } from "@/lib/domain/meals";
import type { Medicine } from "@/lib/domain/types";
import type { Gold } from "./make-images";

/** Compares what readDocument() returned with the right answer from gold.json. Pure code, no AI. */
export type GoldRx = Extract<Gold, { type: "prescription" }>;
type GoldMed = GoldRx["medicines"][number];
export type GoldLab = Extract<Gold, { type: "lab_report" }>;

const normName = (s: string) =>
  s
    .toLowerCase()
    .replace(/^\s*(tab|tablet|cap|capsule)\.?\s+/, "")
    .replace(/[^a-z0-9]/g, "");
const numbers = (s: string) => [...new Set((s.match(/\d+(?:\.\d+)?/g) ?? []).map(Number))].sort((a, b) => a - b).join(",");
const unit = (s: string) => s.toLowerCase().match(/\b(mcg|mg|g|iu|ml)\b/)?.[1] ?? null;

function lev(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

/** Same medicine if the names agree, ignoring "Tab.", spaces and a strength written into the name. */
function sameName(read: string, gold: string): "exact" | "close" | null {
  const r = normName(read).replace(/\d+$/, "");
  const g = normName(gold).replace(/\d+$/, "");
  if (r === g || r.startsWith(g) || g.startsWith(r)) return "exact";
  if (lev(r, g) <= 2 && g.length >= 5) return "close";
  return null;
}

function strengthOk(m: Medicine, g: GoldMed): boolean {
  const readText = `${m.name} ${m.strength}`;
  const goldText = `${g.name} ${g.strength}`;
  if (numbers(readText) !== numbers(goldText)) return false;
  const [ru, gu] = [unit(m.strength), unit(g.strength)];
  return !ru || !gu || ru === gu;
}

const isHalf = (q: string) => /half|1\/2|½|0\.5/i.test(q);

export type LineResult = {
  gold: string;
  read: string | null;
  dangerous: string[];
  minor: string[];
  needsCheck: boolean;
};

export type DocResult = {
  id: string;
  about: string;
  repeat: number;
  ms: number;
  expected: Gold["type"];
  got: ReadResult["type"] | "error";
  lines: LineResult[];
  extra: { read: string; needsCheck: boolean }[];
  docMinor: string[];
  labValues?: { test: string; ok: boolean; flagOk: boolean; got: unknown }[];
  error?: string;
};

export function gradeRx(g: GoldRx, r: Extract<ReadResult, { type: "prescription" }>): Pick<DocResult, "lines" | "extra" | "docMinor"> {
  const today = istNow().date;
  const raw = r.raw as { prescription?: { date_iso: string | null } };
  const left = r.medicines.map((m, i) => ({ m, i }));
  const lines: LineResult[] = g.medicines.map((gm) => {
    const idx = left.findIndex((x) => sameName(x.m.name, gm.name));
    const goldText = `${gm.name} ${gm.strength}`.trim();
    if (idx < 0) return { gold: goldText, read: null, dangerous: ["missed"], minor: [], needsCheck: false };
    const { m } = left.splice(idx, 1)[0];
    const dangerous: string[] = [];
    const minor: string[] = [];
    if (sameName(m.name, gm.name) === "close") dangerous.push(`name "${m.name}"`);
    if (!strengthOk(m, gm)) dangerous.push(`strength "${m.strength}"`);
    if (!!m.asNeeded !== gm.asNeeded) dangerous.push(`only when needed ${!!m.asNeeded}`);
    else if ([...m.meals].sort().join() !== [...gm.meals].sort().join()) dangerous.push(`meals ${m.meals.join("") || "none"}`);
    if (!gm.asNeeded) {
      if (gm.food !== "any" && m.food !== gm.food) dangerous.push(`food ${m.food}`);
      if (gm.food === "any" && m.food !== "any") minor.push(`food ${m.food} not written`);
    }
    if (isHalf(gm.quantity) !== isHalf(m.quantity)) minor.push(`quantity "${m.quantity}"`);
    const wantEnd = courseEnd(g.dateIso, gm.days);
    if ((m.endsOn ?? null) !== wantEnd) minor.push(`last day ${m.endsOn ?? "none"} (want ${wantEnd ?? "none"})`);
    if (gm.purposeWritten) {
      const said = m.purpose?.en.toLowerCase() ?? "";
      const ok = [gm.purposeWritten.toLowerCase(), ...(gm.purposeWritten === "BP" ? ["blood pressure"] : [])].some((w) => said.includes(w));
      if (m.purposeSource !== "prescription" || !ok) minor.push(`purpose "${m.purpose?.en ?? ""}" (${m.purposeSource})`);
    } else if (m.purposeSource === "prescription") {
      minor.push(`purpose "${m.purpose?.en}" marked as written on the slip`);
    }
    return { gold: goldText, read: `${m.name} ${m.strength}`.trim(), dangerous, minor, needsCheck: m.needsCheck };
  });
  const extra = left.map(({ m }) => ({ read: `${m.name} ${m.strength}`.trim(), needsCheck: m.needsCheck }));

  const docMinor: string[] = [];
  if (raw.prescription?.date_iso !== g.dateIso) docMinor.push(`date ${raw.prescription?.date_iso ?? "none"}`);
  const wantFollow = !g.followUp ? null : "afterDays" in g.followUp ? { date: shiftDate(today, g.followUp.afterDays), time: null } : g.followUp;
  const gotFollow = r.followUp;
  if ((wantFollow?.date ?? null) !== (gotFollow?.date ?? null) || (wantFollow?.time ?? null) !== (gotFollow?.time ?? null))
    docMinor.push(`follow-up ${gotFollow ? `${gotFollow.date} ${gotFollow.time ?? ""}`.trim() : "none"} (want ${wantFollow ? `${wantFollow.date} ${wantFollow.time ?? ""}`.trim() : "none"})`);
  return { lines, extra, docMinor };
}

export function gradeLab(g: GoldLab, r: Extract<ReadResult, { type: "lab_report" }>): DocResult["labValues"] {
  return g.values.map((gv) => {
    const v = r.values.find((x) => normName(x.test).includes(normName(gv.test).slice(0, 5)) || normName(gv.test).includes(normName(x.test).slice(0, 5)));
    if (!v) return { test: gv.test, ok: false, flagOk: false, got: null };
    const ok = v.valueNumber === gv.value && v.rangeLow === gv.low && v.rangeHigh === gv.high;
    return { test: gv.test, ok, flagOk: v.flag === gv.flag, got: { value: v.valueNumber, low: v.rangeLow, high: v.rangeHigh, flag: v.flag, range: v.rangeText } };
  });
}

