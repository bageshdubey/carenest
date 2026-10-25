import { AsyncLocalStorage } from "node:async_hooks";
import type { FamilyRow, VisitRow } from "@/lib/db/rows";
import type { Medicine, ParentLang, ReportValue } from "@/lib/domain/types";

/**
 * A made-up family for the evals: "Sarala", 88, and her son "Rohan".
 * Nothing here is real. The database and WhatsApp are replaced by stand-ins
 * that record what the bot would have sent, so only the AI calls are real.
 */
export const PHONES: Record<ParentLang, string> = { en: "910000000001", hi: "910000000002", mr: "910000000003" };

export function family(lang: ParentLang): FamilyRow {
  return {
    id: `eval-${lang}`,
    owner_id: "eval-owner",
    child_name: "Rohan",
    child_lang: "en",
    parent_call_name: "Sarala",
    parent_phone: PHONES[lang],
    parent_lang: lang,
    meal_b: "08:30",
    meal_l: "13:30",
    meal_d: "20:30",
    link_code: "CN-0000",
    parent_linked_at: "2026-10-20T00:00:00Z",
    last_parent_message_at: "2026-10-25T00:00:00Z",
    created_at: "2026-10-20T00:00:00Z",
  };
}

const p = (en: string, hi: string, mr: string) => ({ en, hi, mr });

/** Sarala's approved list. Includes a course with a last day and an "only when needed" medicine. */
export const MEDICINES: Medicine[] = [
  { name: "Amlodipine", strength: "5 mg", quantity: "1 tablet", meals: ["b"], food: "after", purpose: p("blood pressure", "ब्लड प्रेशर", "रक्तदाब"), purposeSource: "prescription", needsCheck: false },
  { name: "Metformin", strength: "500 mg", quantity: "1 tablet", meals: ["b", "d"], food: "after", purpose: p("sugar", "शुगर", "साखर"), purposeSource: "prescription", needsCheck: false },
  { name: "Pantoprazole", strength: "40 mg", quantity: "1 tablet", meals: ["b"], food: "before", purpose: p("acidity", "एसिडिटी", "ॲसिडिटी"), purposeSource: "suggested", needsCheck: false },
  { name: "Atorvastatin", strength: "10 mg", quantity: "1 tablet", meals: ["d"], food: "after", purpose: p("cholesterol", "कोलेस्ट्रॉल", "कोलेस्टेरॉल"), purposeSource: "suggested", needsCheck: false },
  { name: "Azithromycin", strength: "500 mg", quantity: "1 tablet", meals: ["l"], food: "after", purpose: null, purposeSource: "none", needsCheck: false, endsOn: "2026-10-29" },
  { name: "Paracetamol", strength: "650 mg", quantity: "1 tablet", meals: [], food: "after", purpose: p("pain or fever", "दर्द या बुखार", "दुखणे किंवा ताप"), purposeSource: "prescription", needsCheck: false, asNeeded: true },
];

export const VISIT: VisitRow = {
  id: "eval-visit",
  family_id: "eval",
  visit_date: "2026-11-12",
  visit_time: "11:00",
  doctor: "Dr. Mehta",
  source: "child",
  status: "confirmed",
  evening_sent_at: null,
  morning_sent_at: null,
  created_at: "2026-10-20T00:00:00Z",
};

export const REPORT: ReportValue[] = [
  { test: "HbA1c", valueText: "7.9 %", valueNumber: 7.9, unit: "%", rangeText: "4.0 - 5.6", rangeLow: 4, rangeHigh: 5.6, flag: "high", whatItMeasures: null },
  { test: "Haemoglobin", valueText: "12.8 g/dL", valueNumber: 12.8, unit: "g/dL", rangeText: "12.0 - 15.0", rangeLow: 12, rangeHigh: 15, flag: "in_range", whatItMeasures: null },
];

/** What one message led to: every message to the parent, every alert to the child, and what Gemini understood. */
export type Capture = {
  toParent: { body: string; buttons: number }[];
  alerts: { kind: string; detail: unknown }[];
  understood: { heard: string; intent: string; meal: string | null; answer: string | null } | null;
  /** Audio the voice path should "download" for this message. */
  audio?: { bytes: ArrayBuffer; mimeType: string };
};

/** Each case runs in its own context, so cases can run side by side. */
export const capture = new AsyncLocalStorage<Capture>();

export function langOfPhone(phone: string): ParentLang | null {
  const hit = (Object.entries(PHONES) as [ParentLang, string][]).find(([, v]) => v === phone);
  return hit ? hit[0] : null;
}

/** Runs tasks with at most `limit` at a time, keeping their order in the result. */
export async function pool<T, R>(items: T[], limit: number, run: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await run(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}
