import "server-only";
import type { FamilyRow } from "@/lib/db/rows";
import { activeMedicines, addAlert, fillMissingPhotos, logMessage, photoLink } from "@/lib/db/repo";
import { speak } from "@/lib/ai/sarvam";
import { VOICE_NOTE_MAX_BYTES, toVoiceNote } from "@/lib/audio";
import { type Button, sendButtons, sendImage, sendTemplate, sendText, sendVoice } from "@/lib/whatsapp/client";
import { splitMessage } from "@/lib/whatsapp/split";
import type { ChildLang, MealKey, Medicine } from "@/lib/domain/types";
import { fill, pm } from "@/lib/i18n/parent";

/** WhatsApp allows at most 1,024 characters in a message with buttons. */
const BUTTON_BODY_MAX = 1024;
const DAY_MS = 24 * 60 * 60 * 1000;

/** WhatsApp lets us send free messages, voice included, only within 24 hours of the parent's last message. */
export function inWindow(family: FamilyRow): boolean {
  return !!family.last_parent_message_at && Date.now() - new Date(family.last_parent_message_at).getTime() < DAY_MS;
}

/** What the voice reads: the same words, without list bullets. */
function forSpeech(text: string): string {
  return text.replace(/^\s*•\s*/gm, "").trim();
}

/** Speaks the text as a voice note. Never throws: if any step fails, the text message still goes. */
async function sendVoiceNote(family: FamilyRow, text: string) {
  try {
    const speech = await speak(forSpeech(text), family.parent_lang);
    if (!speech) return;
    const note = await toVoiceNote(speech.data, speech.mimeType);
    if (note.length > VOICE_NOTE_MAX_BYTES) return;
    await sendVoice(family.parent_phone, note);
  } catch (e) {
    console.error("Voice note not sent", e);
  }
}

/** Sends a text of any length as one or more WhatsApp messages, in order. Returns the first message's id. */
async function sendLongText(to: string, body: string): Promise<string | null> {
  let first: string | null = null;
  for (const part of splitMessage(body)) {
    const id = await sendText(to, part);
    first ??= id;
  }
  return first;
}

/**
 * Sends a message to the parent, voice note first and the text below it, and records the text
 * for the child's Chat tab. `spoken` is what the voice reads (default: the whole text; null: no voice).
 */
export async function toParent(family: FamilyRow, body: string, buttons: Button[] = [], spoken: string | null = body) {
  if (spoken && inWindow(family)) await sendVoiceNote(family, spoken);
  let id: string | null;
  if (!buttons.length) {
    id = await sendLongText(family.parent_phone, body);
  } else if (body.length <= BUTTON_BODY_MAX) {
    id = await sendButtons(family.parent_phone, body, buttons);
  } else {
    // Too long for buttons: send the text, then the last paragraph (usually the footer) with the buttons.
    const cut = body.lastIndexOf("\n\n");
    const tail = cut > 0 ? body.slice(cut + 2) : "";
    const fits = tail && tail.length <= BUTTON_BODY_MAX;
    id = await sendLongText(family.parent_phone, fits ? body.slice(0, cut) : body);
    await sendButtons(family.parent_phone, fits ? tail : pm(family.parent_lang, "help", { n: family.parent_call_name }), buttons);
  }
  await logMessage(family.id, "out", body, null, id);
  return id;
}

/**
 * One photo per medicine, with its name and how many to take under it, so a parent who can't read
 * the name can match the strip. A sample from the web says it may not look like their strip.
 * Only inside the 24-hour window (a free message). Never throws: the text reminder still goes.
 */
export async function sendMedicinePhotos(family: FamilyRow, meds: Medicine[]) {
  const lang = family.parent_lang;
  // A medicine with no photo yet (typed in by the child, or saved before photos) gets a sample first.
  if (meds.some((m) => m.id && !m.photo)) {
    try {
      await fillMissingPhotos(family.id);
      const fresh = new Map((await activeMedicines(family.id)).map((m) => [m.id, m]));
      meds = meds.map((m) => (m.id && fresh.get(m.id)) || m);
    } catch (e) {
      console.error("Could not fill missing photos", e);
    }
  }
  for (const m of meds) {
    if (!m.photo) continue;
    try {
      const link = await photoLink(m.photo);
      if (!link) continue;
      const name = `${m.name} ${m.strength}`.trim();
      const caption =
        m.photo.kind === "sample"
          ? pm(lang, "photoSample", { m: name, q: m.quantity, s: m.photo.source ?? "" })
          : pm(lang, "photoReal", { m: name, q: m.quantity });
      const id = await sendImage(family.parent_phone, link, caption);
      await logMessage(family.id, "out", `[Photo] ${caption}`, null, id);
    } catch (e) {
      console.error(`Medicine photo not sent for ${m.name}`, e);
    }
  }
}

/**
 * Reminders are often sent more than 24 hours after the parent last wrote. WhatsApp then allows only
 * an approved template, and it reports a refused free message later rather than at once, so the
 * choice is made here from the time of the parent's last message. The template's Taken and Later
 * buttons send the same codes as the normal reminder's.
 * Returns false when the reminder could not go: the window is closed and no template is set.
 */
export async function reminderToParent(family: FamilyRow, body: string, buttons: Button[], templateParams: string[]): Promise<boolean> {
  if (inWindow(family)) {
    await toParent(family, body, buttons);
    return true;
  }
  const template = process.env.WHATSAPP_TEMPLATE_REMINDER;
  if (!template) return false;
  const payloads = buttons.map((b) => b.id).filter((id) => id.startsWith("taken:") || id.startsWith("later:"));
  const id = await sendTemplate(family.parent_phone, template, family.parent_lang, templateParams, payloads);
  await logMessage(family.id, "out", body, null, id);
  return true;
}

type AlertKind = "new_list" | "dose_missed" | "report_out_of_range" | "advice_question" | "emergency" | "course_ended" | "reminder_not_sent";

const ALERT_TEXT: Record<ChildLang, Record<AlertKind, string>> = {
  en: {
    new_list: "CareNest: {n} sent a new prescription. Please check the list: {url}",
    dose_missed: "CareNest: {n} hasn't marked the {meal} tablets as taken.",
    report_out_of_range: "CareNest: {n}'s new report has {k} values outside the printed range. {url}",
    advice_question: 'CareNest: {n} asked "{q}". They were told to ask the doctor or call you.',
    emergency: 'CareNest URGENT: {n} wrote "{q}". Please call now: +{p}',
    course_ended: "CareNest: {n}'s course of {m} has ended. Reminders for it have stopped.",
    reminder_not_sent: "CareNest: Reminders can't reach {n} on WhatsApp: no message from them in 24 hours. Ask them to send any message to CareNest.",
  },
  hi: {
    new_list: "CareNest: {n} ने नया पर्चा भेजा है। कृपया सूची जाँचें: {url}",
    dose_missed: "CareNest: {n} ने {meal} की दवा ली, ऐसा नहीं बताया।",
    report_out_of_range: "CareNest: {n} की नई रिपोर्ट में {k} मान छपी रेंज से बाहर हैं। {url}",
    advice_question: 'CareNest: {n} ने पूछा "{q}"। उन्हें डॉक्टर से पूछने या आपको फ़ोन करने को कहा गया।',
    emergency: 'CareNest तुरंत: {n} ने लिखा "{q}"। कृपया अभी फ़ोन करें: +{p}',
    course_ended: "CareNest: {n} की {m} का कोर्स पूरा हो गया है। इसकी याद दिलाना बंद कर दिया गया है।",
    reminder_not_sent: "CareNest: {n} तक WhatsApp पर याद नहीं पहुँच रही: 24 घंटे से उनका कोई संदेश नहीं आया। उनसे CareNest को कोई भी संदेश भेजने को कहें।",
  },
};

const CHILD_MEAL: Record<ChildLang, Record<MealKey, string>> = {
  en: { b: "breakfast", l: "lunch", d: "dinner" },
  hi: { b: "नाश्ते", l: "दोपहर", d: "रात" },
};

/**
 * Records an alert for the child's dashboard. Nothing is sent to the child's phone:
 * the WhatsApp test number reaches only 5 recipients, so those are kept for parents.
 */
export async function alertChild(
  family: FamilyRow,
  kind: AlertKind,
  detail: { q?: string; k?: number; meal?: MealKey; m?: string } = {},
) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://carenestapp.vercel.app";
  const lang = family.child_lang;
  // One pass, so the parent's own words in {q} are never read as placeholders or "$&" patterns.
  const text = fill(ALERT_TEXT[lang][kind], {
    n: family.parent_call_name,
    url: `${appUrl}/home`,
    q: (detail.q ?? "").slice(0, 200),
    k: String(detail.k ?? ""),
    meal: detail.meal ? CHILD_MEAL[lang][detail.meal] : "",
    m: detail.m ?? "",
    p: family.parent_phone,
  });

  await addAlert(family.id, kind, kind === "emergency" ? "urgent" : "check", { ...detail, text }, false);
}
