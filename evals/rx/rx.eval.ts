import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { test } from "vitest";
import { readDocument, type ReadResult } from "@/lib/ai/gemini";
import { pool } from "../shared/fixture";
import { type DocResult, type GoldRx, gradeLab, gradeRx } from "./grade";
import type { Gold } from "./make-images";

/**
 * Prescription and report reading eval. Each made-up photo goes through the real readDocument()
 * and code compares every field with the answer written by make-images.ts.
 *
 * Dangerous errors: a medicine missed or added, wrong name, strength, meal, before/after food,
 * or "only when needed" read as a daily medicine (or the reverse).
 * Minor errors: how many, last day of a course, written purpose, follow-up date.
 * The number that matters most: of the dangerous errors, how many were marked "Please check".
 *
 * Run: node --env-file=../carenest/.env.local node_modules/.bin/vitest run --config evals/vitest.config.mts evals/rx
 * REPEATS (default 2) reads each photo several times.
 */

const HERE = new URL(".", import.meta.url);
const GOLD: Gold[] = JSON.parse(readFileSync(new URL("gold.json", HERE), "utf8"));
async function runOne(g: Gold, repeat: number): Promise<DocResult> {
  const bytes = readFileSync(new URL(`images/${g.file}`, HERE));
  const base = { id: g.id, about: g.about, repeat, expected: g.type, lines: [], extra: [], docMinor: [] };
  const t0 = Date.now();
  let r: ReadResult;
  try {
    r = await readDocument(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, "image/jpeg");
  } catch (e) {
    return { ...base, ms: Date.now() - t0, got: "error", error: String(e) };
  }
  const ms = Date.now() - t0;
  if (g.type === "prescription" && r.type === "prescription") return { ...base, ms, got: r.type, ...gradeRx(g, r) };
  if (g.type === "lab_report" && r.type === "lab_report") return { ...base, ms, got: r.type, labValues: gradeLab(g, r) };
  return { ...base, ms, got: r.type };
}

test("prescription and report reading", async () => {
  const repeats = Number(process.env.REPEATS || 2);
  const jobs = GOLD.flatMap((g) => Array.from({ length: repeats }, (_, r) => ({ g, r })));
  const results = await pool(jobs, 4, ({ g, r }) => runOne(g, r));

  const out = new URL("../out/", import.meta.url);
  mkdirSync(out, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  writeFileSync(new URL(`rx-${stamp}.json`, out), JSON.stringify({ model: process.env.GEMINI_MODEL || "gemini-flash-latest", repeats, results }, null, 2));

  const tierOf = (id: string) => (GOLD.find((g) => g.id === id) as GoldRx | undefined)?.hard ? "hard" : "clean";
  const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : "n/a");
  const rxSummary = (label: string, rx: DocResult[]) => {
    const read = rx.filter((d) => d.got === "prescription");
    const lines = read.flatMap((d) => d.lines);
    const dangerousLines = lines.filter((l) => l.dangerous.length);
    const caught = dangerousLines.filter((l) => l.needsCheck);
    const extras = read.flatMap((d) => d.extra);
    const clean = lines.filter((l) => !l.dangerous.length && !l.minor.length);
    const falseAlarms = lines.filter((l) => !l.dangerous.length && l.needsCheck);
    return [
      `## Prescriptions, ${label} (${rx.length / repeats} photos x ${repeats} reads)`,
      `Read as a prescription: ${read.length}/${rx.length} (others: ${rx.filter((d) => d.got !== "prescription").map((d) => `${d.id}=${d.got}`).join(", ") || "none"})`,
      `Medicine lines: ${lines.length}. Fully right: ${clean.length} (${pct(clean.length, lines.length)}). With a dangerous error: ${dangerousLines.length} (${pct(dangerousLines.length, lines.length)})`,
      `Dangerous errors marked "Please check": ${caught.length}/${dangerousLines.length} (${pct(caught.length, dangerousLines.length)})`,
      `Medicines added that are not on the slip: ${extras.length} (marked: ${extras.filter((e) => e.needsCheck).length})`,
      `Lines with a minor error only: ${lines.filter((l) => !l.dangerous.length && l.minor.length).length}`,
      `"Please check" on a line with no dangerous error (extra work for the child): ${falseAlarms.length}/${lines.length - dangerousLines.length}`,
      "",
    ];
  };
  const rxAll = results.filter((d) => d.expected === "prescription");
  const labs = results.filter((d) => d.expected === "lab_report");
  const labValues = labs.flatMap((d) => d.labValues ?? []);
  const others = results.filter((d) => d.expected === "other" || d.expected === "unreadable");
  const ms = results.map((d) => d.ms).sort((a, b) => a - b);

  const md: string[] = [
    ...rxSummary("clean photos", rxAll.filter((d) => tierOf(d.id) === "clean")),
    ...rxSummary("hard photos", rxAll.filter((d) => tierOf(d.id) === "hard")),
    `## Lab reports (${labs.length / repeats} photos x ${repeats})`,
    `Read as a report: ${labs.filter((d) => d.got === "lab_report").length}/${labs.length}`,
    `Values and printed range read right: ${labValues.filter((v) => v.ok).length}/${labValues.length}`,
    `High/Low flag matches the printed range (PRD measure 2): ${labValues.filter((v) => v.flagOk).length}/${labValues.length}`,
    "",
    `## Not a prescription`,
    ...others.map((d) => `- ${d.id} (${d.about}) run ${d.repeat + 1}: expected ${d.expected}, got ${d.got}`),
    "",
    `Time per photo: median ${(ms[Math.floor(ms.length / 2)] / 1000).toFixed(1)} s, slowest ${(ms[ms.length - 1] / 1000).toFixed(1)} s`,
    "",
    "## Every error",
  ];
  for (const d of results) {
    const items = [
      ...d.lines.filter((l) => l.dangerous.length || l.minor.length).map((l) => `${l.gold}: ${[...l.dangerous.map((x) => `DANGEROUS ${x}`), ...l.minor].join("; ")}${l.dangerous.length ? (l.needsCheck ? " [marked Please check]" : " [NOT marked]") : ""}`),
      ...d.extra.map((e) => `extra medicine "${e.read}"${e.needsCheck ? " [marked Please check]" : " [NOT marked]"}`),
      ...d.docMinor,
      ...(d.labValues ?? []).filter((v) => !v.ok || !v.flagOk).map((v) => `${v.test}: ${JSON.stringify(v.got)}`),
      ...(d.got !== d.expected ? [`read as ${d.got}${d.error ? ` (${d.error})` : ""}`] : []),
    ];
    if (items.length) md.push(`- ${d.id} (${d.about}) run ${d.repeat + 1}:`, ...items.map((i) => `  - ${i}`));
  }
  writeFileSync(new URL(`rx-${stamp}.md`, out), md.join("\n"));
  console.log(md.join("\n"));
});
