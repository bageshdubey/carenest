import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import * as z from "zod/v4";
import { flagValue, parseRange } from "@/lib/domain/report";
import type { Food, MealKey, Medicine, ParentLang, ReportValue } from "@/lib/domain/types";

/**
 * All Claude calls live here. The model only reads documents and answers from
 * the parent's own approved list. It never gives advice: advice questions are
 * classified and answered with a fixed message in code.
 */
const MODEL = "claude-opus-5-5";
let _client: Anthropic | null = null;
/** Created on first use, so builds work without the API key set. */
function claude(): Anthropic {
  return (_client ??= new Anthropic());
}

const Tri = z.object({ en: z.string(), hi: z.string(), mr: z.string() });

const DocumentSchema = z.object({
  document_type: z.enum(["prescription", "lab_report", "other"]),
  readable: z.boolean().describe("False if the photo is too blurry or cut off to read reliably."),
  prescription: z
    .object({
      doctor: z.string().nullable(),
      date: z.string().nullable(),
      medicines: z.array(
        z.object({
          name: z.string().describe("Medicine or brand name exactly as written."),
          strength: z.string().describe('For example "5 mg". Empty string if not written.'),
          quantity: z.string().describe('How many per dose, for example "1 tablet".'),
          morning: z.boolean(),
          afternoon: z.boolean(),
          night: z.boolean(),
          food: z.enum(["before", "after", "any", "unknown"]),
          purpose_written: Tri.nullable().describe("Only if the prescription itself says what it is for. Short, plain words, in English, Hindi and Marathi."),
          purpose_general: Tri.nullable().describe("What this medicine is generally used for, 1 to 3 plain words. Null if unsure."),
          unclear: z.boolean().describe("True if any part of this line was hard to read."),
        }),
      ),
    })
    .nullable(),
  lab_report: z
    .object({
      lab: z.string().nullable(),
      date: z.string().nullable(),
      values: z.array(
        z.object({
          test: z.string(),
          value_text: z.string().describe("Value with unit, exactly as printed."),
          value_number: z.number().nullable(),
          unit: z.string().nullable(),
          range_text: z.string().nullable().describe("Reference range exactly as printed. Null if none."),
          what_it_measures: Tri.nullable().describe("What the test measures, under 8 plain words, no judgement about the value."),
        }),
      ),
    })
    .nullable(),
});

export type ReadResult =
  | { type: "prescription"; medicines: Medicine[]; doctor: string | null; date: string | null; raw: unknown }
  | { type: "lab_report"; values: ReportValue[]; lab: string | null; date: string | null; raw: unknown }
  | { type: "unreadable" }
  | { type: "other" };

const READ_SYSTEM = `You read photos of Indian prescriptions and lab reports for an app that helps older people.
Copy what is written. Do not guess medicine names: if a name is hard to read, give your best reading and set unclear to true.
Map timings: morning or 1-0-0 to morning, afternoon or 0-1-0 to afternoon, night, bedtime or 0-0-1 to night. "BD" means morning and night. "TDS" means morning, afternoon and night. "OD" means once a day; use morning unless the slip says otherwise.
For lab reports, copy each test, its value and the reference range printed on the report. Never say whether a value is good or bad.
Never add advice, diagnosis or instructions that are not on the document.`;

function toMeals(m: { morning: boolean; afternoon: boolean; night: boolean }): MealKey[] {
  const out: MealKey[] = [];
  if (m.morning) out.push("b");
  if (m.afternoon) out.push("l");
  if (m.night) out.push("d");
  return out;
}

export async function readDocument(bytes: ArrayBuffer, mimeType: string): Promise<ReadResult> {
  const data = Buffer.from(bytes).toString("base64");
  const isPdf = mimeType === "application/pdf";
  const media = isPdf
    ? ({ type: "document", source: { type: "base64", media_type: "application/pdf", data } } as const)
    : ({
        type: "image",
        source: { type: "base64", media_type: (["image/png", "image/webp", "image/gif"].includes(mimeType) ? mimeType : "image/jpeg") as "image/jpeg", data },
      } as const);

  const response = await claude().messages.parse({
    model: MODEL,
    max_tokens: 16000,
    system: READ_SYSTEM,
    output_config: { effort: "medium", format: zodOutputFormat(DocumentSchema) },
    messages: [{ role: "user", content: [media, { type: "text", text: "Read this document." }] }],
  });

  if (response.stop_reason === "refusal" || !response.parsed_output) return { type: "unreadable" };
  const doc = response.parsed_output;
  if (!doc.readable) return { type: "unreadable" };

  if (doc.document_type === "prescription" && doc.prescription) {
    const medicines: Medicine[] = doc.prescription.medicines.map((m) => {
      const meals = toMeals(m);
      const purpose = m.purpose_written ?? m.purpose_general;
      return {
        name: m.name,
        strength: m.strength,
        quantity: m.quantity,
        meals,
        food: (m.food === "unknown" ? "any" : m.food) as Food,
        purpose,
        purposeSource: m.purpose_written ? "prescription" : m.purpose_general ? "suggested" : "none",
        needsCheck: m.unclear || meals.length === 0 || m.food === "unknown",
      };
    });
    return { type: "prescription", medicines, doctor: doc.prescription.doctor, date: doc.prescription.date, raw: doc };
  }

  if (doc.document_type === "lab_report" && doc.lab_report) {
    const values: ReportValue[] = doc.lab_report.values.map((v) => {
      const { low, high } = parseRange(v.range_text);
      return {
        test: v.test,
        valueText: v.value_text,
        valueNumber: v.value_number,
        unit: v.unit,
        rangeText: v.range_text,
        rangeLow: low,
        rangeHigh: high,
        flag: flagValue(v.value_number, low, high),
        whatItMeasures: v.what_it_measures,
      };
    });
    return { type: "lab_report", values, lab: doc.lab_report.lab, date: doc.lab_report.date, raw: doc };
  }

  return { type: "other" };
}

const AnswerSchema = z.object({
  intent: z.enum(["about_my_medicines", "advice", "greeting", "other"]),
  answer: z.string().nullable().describe("Only for about_my_medicines. Plain, short, in the requested language."),
});

const ANSWER_SYSTEM = `You help an older person in India understand their own medicine list. You are not a doctor.
Classify the message:
- about_my_medicines: what a medicine on the list is for, when to take it, which meal, before or after food, what is on the list.
- advice: anything asking whether to skip, stop, change, double, mix or replace a medicine, side effects, symptoms, substitutes or "is it safe".
- greeting: hello, thanks, ok.
- other: anything else.
For about_my_medicines, answer in 1 to 3 short sentences using only the list provided. If the list does not have the answer, set intent to other.
Never give advice, a diagnosis or an opinion.`;

export async function answerQuestion(
  question: string,
  meds: Medicine[],
  lang: ParentLang,
): Promise<{ intent: z.infer<typeof AnswerSchema>["intent"]; answer: string | null }> {
  const list = meds.map((m) => ({ name: m.name, strength: m.strength, quantity: m.quantity, meals: m.meals, food: m.food, for: m.purpose?.en ?? null }));
  const langName = { en: "English", hi: "Hindi", mr: "Marathi" }[lang];
  const response = await claude().messages.parse({
    model: MODEL,
    max_tokens: 4000,
    system: ANSWER_SYSTEM,
    output_config: { effort: "low", format: zodOutputFormat(AnswerSchema) },
    messages: [
      {
        role: "user",
        content: `Medicine list (meals: b = breakfast, l = lunch, d = dinner):\n${JSON.stringify(list)}\n\nReply language: ${langName}\n\nMessage:\n${question}`,
      },
    ],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) return { intent: "other", answer: null };
  return response.parsed_output;
}
