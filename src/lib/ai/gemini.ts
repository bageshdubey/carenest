import { ApiError, FinishReason, GoogleGenAI, type GenerateContentParameters, type Part } from "@google/genai";
import * as z from "zod/v4";
import { shiftDate } from "@/lib/domain/adherence";
import { courseEnd, courseEnded } from "@/lib/domain/course";
import { istNow } from "@/lib/domain/meals";
import { flagValue, parseRange } from "@/lib/domain/report";
import type { Food, MealKey, Medicine, ParentLang, ReportValue } from "@/lib/domain/types";

/**
 * All Gemini calls live here. The model only reads documents and answers from
 * the parent's own approved list. It never gives advice: advice questions are
 * classified and answered with a fixed message in code.
 */
/** Can be changed in env without a code change. */
const MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";
/** Tried when the main model stays busy or fails. */
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || "gemini-flash-lite-latest";
let _client: GoogleGenAI | null = null;
/** Created on first use, so builds work without the API key set. */
function gemini(): GoogleGenAI {
  return (_client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }));
}

/** Thrown when Gemini gives no usable answer in time, so the bot can ask the parent to send again. */
export class AiBusyError extends Error {}

const BUSY_STATUS = new Set([429, 500, 503]);
const TRIES_PER_MODEL = 3;
/** One photo can take 20 to 80 s on Gemini. The webhook may run 300 s; this leaves time to speak, save and reply. */
const BUDGET_MS = 150_000;
const MIN_TRY_MS = 5_000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Busy errors and timeouts are retried with short waits (1 s, 2 s). Any other error
 * (for example a model this key cannot use) moves straight to the next model.
 */
async function generate(params: Omit<GenerateContentParameters, "model">, models = [MODEL, FALLBACK_MODEL], budgetMs = BUDGET_MS) {
  const deadline = Date.now() + budgetMs;
  for (const model of models) {
    for (let attempt = 0; attempt < TRIES_PER_MODEL; attempt++) {
      const left = deadline - Date.now();
      if (left < MIN_TRY_MS) throw new AiBusyError("Gemini ran out of time");
      try {
        return await gemini().models.generateContent({ ...params, model, config: { ...params.config, abortSignal: AbortSignal.timeout(left) } });
      } catch (e) {
        if (e instanceof ApiError && !BUSY_STATUS.has(e.status)) {
          console.error(`Gemini ${model} failed with ${e.status}, trying the next model`, e.message);
          break;
        }
        if (attempt < TRIES_PER_MODEL - 1) await sleep(1000 * 2 ** attempt);
      }
    }
  }
  throw new AiBusyError("Gemini gave no answer on any model");
}

/** Asks for JSON matching the schema. Null if Gemini blocked it, stopped early, or the JSON does not match. Throws AiBusyError if Gemini stays busy. */
async function generateJson<T extends z.ZodType>(schema: T, systemInstruction: string, parts: Part[]): Promise<z.infer<T> | null> {
  const jsonSchema: Record<string, unknown> = { ...z.toJSONSchema(schema) };
  delete jsonSchema.$schema;
  const response = await generate({
    contents: [{ role: "user", parts }],
    config: { systemInstruction, responseMimeType: "application/json", responseJsonSchema: jsonSchema },
  });
  if (response.promptFeedback?.blockReason) return null;
  const finish = response.candidates?.[0]?.finishReason;
  if (finish && finish !== FinishReason.STOP) return null;
  if (!response.text) return null;
  try {
    const parsed = schema.safeParse(JSON.parse(response.text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

const READABLE_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

const Tri = z.object({ en: z.string(), hi: z.string(), mr: z.string() });

const DocumentSchema = z.object({
  document_type: z.enum(["prescription", "lab_report", "other"]),
  readable: z.boolean().describe("False if the photo is too blurry or cut off to read reliably."),
  prescription: z
    .object({
      doctor: z.string().nullable(),
      date: z.string().nullable(),
      date_iso: z.string().nullable().describe("The prescription date as YYYY-MM-DD, if written. Null if not written or unclear."),
      medicines: z.array(
        z.object({
          name: z.string().describe("Medicine or brand name exactly as written."),
          strength: z.string().describe('For example "5 mg". Empty string if not written.'),
          quantity: z.string().describe('How many per dose, for example "1 tablet".'),
          morning: z.boolean(),
          afternoon: z.boolean(),
          night: z.boolean(),
          food: z.enum(["before", "after", "any", "unknown"]),
          days: z
            .number()
            .nullable()
            .describe('How many days to take it, only if written for this line or for the whole slip ("x 7 days", "for 5 days", "1 week" is 7). Null if not written or "continue".'),
          as_needed: z.boolean().describe('True if it is taken only when needed: "SOS", "PRN", "as needed", "if pain", "if fever", "when required".'),
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
          what_it_is: Tri.nullable().describe("What the test is, under 12 plain words. Never name a disease or condition."),
          why_done: Tri.nullable().describe(
            "Why the test is done, under 12 plain words, as what in the body is being checked. Never name a disease or condition, and no judgement about the value.",
          ),
        }),
      ),
    })
    .nullable(),
  follow_up: z
    .object({
      date: z.string().nullable().describe("Next visit or review date if a date is written, as YYYY-MM-DD."),
      after_days: z.number().nullable().describe('If it says to come back after some time, that time in days. "After 2 weeks" is 14.'),
      time: z.string().nullable().describe('Visit time if written, as HH:MM in 24-hour time.'),
    })
    .nullable()
    .describe("Only if the document itself says when to see the doctor again."),
});

/** A next-visit date found on a photo. It waits for the child's check before any reminder. */
export type FollowUp = { date: string; time: string | null };

export type ReadResult =
  | { type: "prescription"; medicines: Medicine[]; doctor: string | null; date: string | null; followUp: FollowUp | null; raw: unknown }
  | { type: "lab_report"; values: ReportValue[]; lab: string | null; date: string | null; followUp: FollowUp | null; raw: unknown }
  | { type: "unreadable" }
  | { type: "other" };

const READ_SYSTEM = `You read photos of Indian prescriptions and lab reports for an app that helps older people.
Copy what is written. Do not guess medicine names: if a name is hard to read, give your best reading and set unclear to true.
Map timings: morning or 1-0-0 to morning, afternoon or 0-1-0 to afternoon, night, bedtime or 0-0-1 to night. "BD" means morning and night. "TDS" means morning, afternoon and night. "OD" means once a day; use morning unless the slip says otherwise.
A medicine taken only when needed ("SOS", "PRN", "as needed", "if pain") gets as_needed true and no morning, afternoon or night.
Copy how many days only if it is written; never work out a course length yourself.
For lab reports, copy each test, its value and the reference range printed on the report. Never say whether a value is good or bad.
If the document says when to come back (follow-up, review, next visit, "SOS" does not count), fill follow_up. Otherwise set it to null.
Never add advice, diagnosis or instructions that are not on the document.`;

/**
 * What the test is and why it's done, kept as two lines in one text per language,
 * so it fits the existing what_it_measures column. Reports saved before this have one line.
 */
function describeTest(isText: z.infer<typeof Tri> | null, why: z.infer<typeof Tri> | null): z.infer<typeof Tri> | null {
  if (!isText && !why) return null;
  const join = (l: "en" | "hi" | "mr") => {
    const a = isText?.[l]?.trim() ?? "";
    const b = why?.[l]?.trim() ?? "";
    return b ? `${a}\n${b}` : a;
  };
  return { en: join("en"), hi: join("hi"), mr: join("mr") };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Turns a written follow-up into a future date, counting "after N days" from today. Past or unreadable dates are dropped. */
function toFollowUp(f: { date: string | null; after_days: number | null; time: string | null } | null): FollowUp | null {
  if (!f) return null;
  const today = istNow().date;
  let date: string | null = null;
  if (f.date && ISO_DATE.test(f.date)) date = f.date;
  else if (f.after_days && f.after_days > 0 && f.after_days <= 365) date = shiftDate(today, Math.round(f.after_days));
  if (!date || date < today) return null;
  return { date, time: f.time && HH_MM.test(f.time) ? f.time : null };
}

function toMeals(m: { morning: boolean; afternoon: boolean; night: boolean }): MealKey[] {
  const out: MealKey[] = [];
  if (m.morning) out.push("b");
  if (m.afternoon) out.push("l");
  if (m.night) out.push("d");
  return out;
}

export async function readDocument(bytes: ArrayBuffer, mimeType: string): Promise<ReadResult> {
  const data = Buffer.from(bytes).toString("base64");
  const media: Part = { inlineData: { mimeType: READABLE_TYPES.includes(mimeType) ? mimeType : "image/jpeg", data } };

  const doc = await generateJson(DocumentSchema, READ_SYSTEM, [media, { text: "Read this document." }]);
  if (!doc || !doc.readable) return { type: "unreadable" };

  if (doc.document_type === "prescription" && doc.prescription) {
    const today = istNow().date;
    // A course counts from the prescription date; with no readable date, from the day the photo came in.
    const rxDate = doc.prescription.date_iso;
    const start = rxDate && ISO_DATE.test(rxDate) && rxDate <= today ? rxDate : today;
    const medicines: Medicine[] = doc.prescription.medicines.map((m) => {
      const asNeeded = m.as_needed;
      const meals = asNeeded ? [] : toMeals(m);
      const purpose = m.purpose_written ?? m.purpose_general;
      const endsOn = asNeeded ? null : courseEnd(start, m.days);
      return {
        name: m.name,
        strength: m.strength,
        quantity: m.quantity,
        meals,
        food: (m.food === "unknown" ? "any" : m.food) as Food,
        purpose,
        purposeSource: m.purpose_written ? "prescription" : m.purpose_general ? "suggested" : "none",
        // A course already over on an old slip is marked, so the child decides before it is used.
        needsCheck: m.unclear || (!asNeeded && meals.length === 0) || m.food === "unknown" || courseEnded(endsOn, today),
        endsOn,
        asNeeded,
      };
    });
    return { type: "prescription", medicines, doctor: doc.prescription.doctor, date: doc.prescription.date, followUp: toFollowUp(doc.follow_up), raw: doc };
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
        whatItMeasures: describeTest(v.what_it_is, v.why_done),
      };
    });
    return { type: "lab_report", values, lab: doc.lab_report.lab, date: doc.lab_report.date, followUp: toFollowUp(doc.follow_up), raw: doc };
  }

  return { type: "other" };
}

const UnderstandSchema = z.object({
  heard: z
    .string()
    .describe("For a voice note: exactly what the person said, in the language and script they spoke (Devanagari for Hindi and Marathi). For a text message: copy it."),
  intent: z.enum(["meds_for_meal", "meds_count", "full_list", "report", "next_visit", "about_my_medicines", "advice", "greeting", "other"]),
  meal: z
    .enum(["b", "l", "d"])
    .nullable()
    .describe("Only for meds_for_meal: b = morning or breakfast, l = afternoon or lunch, d = evening, night or dinner."),
  answer: z.string().nullable().describe("Only for about_my_medicines: 1 to 3 short sentences in the reply language, from the list only."),
});

export type Intent = z.infer<typeof UnderstandSchema>["intent"];
export type Understood = { heard: string; intent: Intent; meal: MealKey | null; answer: string | null };

const UNDERSTAND_SYSTEM = `You help an older person in India with their own medicines, reports and doctor visits. You are an analyst, never a doctor.
The person writes or speaks in Hindi, Marathi or English, often mixed. First write down what they said in "heard".
Then pick one intent:
- meds_for_meal: which medicines to take at one time of day ("what do I take in the morning", "dopahar ki dawai"). Set meal.
- meds_count: how many medicines they have.
- full_list: the whole medicine list.
- report: what their blood or lab report shows.
- next_visit: when their next doctor visit or appointment is.
- about_my_medicines: what a medicine on the list is for, before or after food, or what a medicine on the list is.
- advice: whether to skip, stop, change, double, mix or replace a medicine; side effects; symptoms or how they feel; substitutes; "is it safe"; what a report value means for their health.
- greeting: hello, thanks, ok.
- other: anything else.
Only for about_my_medicines, write "answer" using only the list given. If the list does not have it, use intent other.
In Hindi or Marathi, if the answer says "I" for CareNest, use feminine forms (करती हूँ, सकती हूँ; करते, शकते): the voice is a woman's.
Never give advice, a diagnosis or an opinion.`;

/** Strips codec details: WhatsApp sends "audio/ogg; codecs=opus", Gemini wants "audio/ogg". */
function baseMime(mimeType: string): string {
  return mimeType.split(";")[0].trim().toLowerCase();
}

/**
 * Understands one message from the parent, typed or spoken. Gemini only classifies it
 * (and answers simple questions about the list); every other reply is built in code from their own data.
 */
export async function understand(
  input: { text: string } | { audio: ArrayBuffer; mimeType: string },
  meds: Medicine[],
  lang: ParentLang,
): Promise<Understood> {
  const list = meds.map((m) => ({
    name: m.name,
    strength: m.strength,
    quantity: m.quantity,
    meals: m.meals,
    food: m.food,
    for: m.purpose?.en ?? null,
    only_when_needed: m.asNeeded ?? false,
    last_day: m.endsOn ?? null,
  }));
  const langName = { en: "English", hi: "Hindi", mr: "Marathi" }[lang];
  const context: Part = {
    text: `Medicine list (meals: b = breakfast, l = lunch, d = dinner):\n${JSON.stringify(list)}\n\nReply language: ${langName}\n\n${"text" in input ? `Message:\n${input.text}` : "The message is the voice note above."}`,
  };
  const parts: Part[] = "text" in input ? [context] : [{ inlineData: { mimeType: baseMime(input.mimeType), data: Buffer.from(input.audio).toString("base64") } }, context];
  const result = await generateJson(UnderstandSchema, UNDERSTAND_SYSTEM, parts);
  const heard = "text" in input ? input.text : (result?.heard ?? "").trim();
  if (!result) return { heard, intent: "other", meal: null, answer: null };
  return { heard, intent: result.intent, meal: result.meal, answer: result.answer };
}
