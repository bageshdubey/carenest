import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import type { ReadResult } from "@/lib/ai/gemini";
import { courseEnd } from "@/lib/domain/course";
import type { Medicine } from "@/lib/domain/types";
import { type GoldRx, gradeRx } from "./grade";
import type { Gold } from "./make-images";

/**
 * Checks the grader itself, with no AI call: a perfect reading built from the answers must pass,
 * and each kind of deliberate mistake must be caught. Guards against a grader that passes everything.
 */

const GOLD: Gold[] = JSON.parse(readFileSync(new URL("gold.json", import.meta.url), "utf8"));
const g = GOLD.find((x) => x.id === "P16") as GoldRx; // course, SOS and ongoing lines

function perfect(): Extract<ReadResult, { type: "prescription" }> {
  const medicines: Medicine[] = g.medicines.map((m) => ({
    name: `Tab. ${m.name}`,
    strength: m.strength,
    quantity: m.quantity,
    meals: m.meals,
    food: m.food,
    purpose: m.purposeWritten ? { en: m.purposeWritten, hi: "", mr: "" } : null,
    purposeSource: m.purposeWritten ? "prescription" : "none",
    needsCheck: false,
    endsOn: courseEnd(g.dateIso, m.days),
    asNeeded: m.asNeeded,
  }));
  return { type: "prescription", medicines, doctor: null, date: null, followUp: null, raw: { prescription: { date_iso: g.dateIso } } };
}

const dangerous = (r: ReturnType<typeof perfect>) => gradeRx({ ...g, followUp: null }, r).lines.flatMap((l) => l.dangerous);

test("a perfect reading has no errors", () => {
  const res = gradeRx({ ...g, followUp: null }, perfect());
  expect(res.lines.every((l) => !l.dangerous.length && !l.minor.length)).toBe(true);
  expect(res.extra).toEqual([]);
});

test.each([
  ["wrong strength", (r: ReturnType<typeof perfect>) => (r.medicines[0].strength = "250 mg"), /strength/],
  ["mg read as mcg", (r: ReturnType<typeof perfect>) => (r.medicines[0].strength = "500 mcg"), /strength/],
  ["wrong meal", (r: ReturnType<typeof perfect>) => (r.medicines[0].meals = ["b"]), /meals/],
  ["wrong food timing", (r: ReturnType<typeof perfect>) => (r.medicines[0].food = "before"), /food/],
  ["SOS read as daily", (r: ReturnType<typeof perfect>) => ((r.medicines[1].asNeeded = false), (r.medicines[1].meals = ["b"])), /only when needed/],
  ["near-miss name", (r: ReturnType<typeof perfect>) => (r.medicines[2].name = "Telmisartin"), /name/],
  ["missed line", (r: ReturnType<typeof perfect>) => r.medicines.splice(1, 1), /missed/],
])("catches %s", (_label, mutate, want) => {
  const r = perfect();
  mutate(r);
  expect(dangerous(r).join(" ")).toMatch(want);
});

test("catches an added medicine and a different medicine", () => {
  const r = perfect();
  r.medicines.push({ ...r.medicines[0], name: "Cefixime" });
  expect(gradeRx({ ...g, followUp: null }, r).extra.length).toBe(1);
  r.medicines[2].name = "Losartan";
  const res = gradeRx({ ...g, followUp: null }, r);
  expect(res.lines.some((l) => l.dangerous.includes("missed"))).toBe(true);
});
