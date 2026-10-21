import "server-only";
import type { FamilyRow } from "@/lib/db/rows";
import { addAlert, logMessage } from "@/lib/db/repo";
import { type Button, OUTSIDE_WINDOW, WhatsAppError, sendButtons, sendTemplate, sendText } from "@/lib/whatsapp/client";
import type { ChildLang, MealKey } from "@/lib/domain/types";
import { pm } from "@/lib/i18n/parent";

/** WhatsApp allows at most 1,024 characters in a message with buttons. */
const BUTTON_BODY_MAX = 1024;

/** Sends a message to the parent and records it for the child's Chat tab. */
export async function toParent(family: FamilyRow, body: string, buttons: Button[] = []) {
  let id: string | null;
  if (!buttons.length) {
    id = await sendText(family.parent_phone, body);
  } else if (body.length <= BUTTON_BODY_MAX) {
    id = await sendButtons(family.parent_phone, body, buttons);
  } else {
    // Too long for buttons: send the text, then the last paragraph (usually the footer) with the buttons.
    const cut = body.lastIndexOf("\n\n");
    const tail = cut > 0 ? body.slice(cut + 2) : "";
    const fits = tail && tail.length <= BUTTON_BODY_MAX;
    id = await sendText(family.parent_phone, fits ? body.slice(0, cut) : body);
    await sendButtons(family.parent_phone, fits ? tail : pm(family.parent_lang, "help", { n: family.parent_call_name }), buttons);
  }
  await logMessage(family.id, "out", body, null, id);
  return id;
}

/**
 * Reminders are often sent more than 24 hours after the parent last wrote.
 * WhatsApp then only allows an approved template, so fall back to one when configured.
 */
export async function reminderToParent(family: FamilyRow, body: string, buttons: Button[], templateParams: string[]) {
  try {
    return await toParent(family, body, buttons);
  } catch (e) {
    const template = process.env.WHATSAPP_TEMPLATE_REMINDER;
    if (e instanceof WhatsAppError && e.code === OUTSIDE_WINDOW && template) {
      const id = await sendTemplate(family.parent_phone, template, family.parent_lang === "en" ? "en" : family.parent_lang, templateParams);
      await logMessage(family.id, "out", body, null, id);
      return id;
    }
    throw e;
  }
}

type AlertKind = "new_list" | "dose_missed" | "report_out_of_range" | "advice_question" | "emergency";

const ALERT_TEXT: Record<ChildLang, Record<AlertKind, string>> = {
  en: {
    new_list: "CareNest: {n} sent a new prescription. Please check the list: {url}",
    dose_missed: "CareNest: {n} hasn't marked the {meal} tablets as taken.",
    report_out_of_range: "CareNest: {n}'s new report has {k} values outside the printed range. {url}",
    advice_question: 'CareNest: {n} asked "{q}". They were told to ask the doctor or call you.',
    emergency: 'CareNest URGENT: {n} wrote "{q}". Please call now: +{p}',
  },
  hi: {
    new_list: "CareNest: {n} ने नया पर्चा भेजा है। कृपया सूची जाँचें: {url}",
    dose_missed: "CareNest: {n} ने {meal} की दवा ली, ऐसा नहीं बताया।",
    report_out_of_range: "CareNest: {n} की नई रिपोर्ट में {k} मान छपी रेंज से बाहर हैं। {url}",
    advice_question: 'CareNest: {n} ने पूछा "{q}"। उन्हें डॉक्टर से पूछने या आपको फ़ोन करने को कहा गया।',
    emergency: 'CareNest तुरंत: {n} ने लिखा "{q}"। कृपया अभी फ़ोन करें: +{p}',
  },
};

const CHILD_MEAL: Record<ChildLang, Record<MealKey, string>> = {
  en: { b: "breakfast", l: "lunch", d: "dinner" },
  hi: { b: "नाश्ते", l: "दोपहर", d: "रात" },
};

/**
 * Records an alert for the dashboard and tries to send it to the child on WhatsApp.
 * The dashboard always has it, even if WhatsApp delivery fails.
 */
export async function alertChild(
  family: FamilyRow,
  kind: AlertKind,
  detail: { q?: string; k?: number; meal?: MealKey } = {},
) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://carenestapp.vercel.app";
  const lang = family.child_lang;
  const text = ALERT_TEXT[lang][kind]
    .replace("{n}", family.parent_call_name)
    .replace("{url}", `${appUrl}/home`)
    .replace("{q}", (detail.q ?? "").slice(0, 200))
    .replace("{k}", String(detail.k ?? ""))
    .replace("{meal}", detail.meal ? CHILD_MEAL[lang][detail.meal] : "")
    .replace("{p}", family.parent_phone);

  let sent = false;
  if (family.child_phone) {
    try {
      await sendText(family.child_phone, text);
      sent = true;
    } catch (e) {
      const template = process.env.WHATSAPP_TEMPLATE_ALERT;
      if (e instanceof WhatsAppError && e.code === OUTSIDE_WINDOW && template) {
        await sendTemplate(family.child_phone, template, lang, [text.replace(/\n/g, " ")]);
        sent = true;
      } else {
        console.error("Child alert not delivered", e);
      }
    }
  }
  await addAlert(family.id, kind, kind === "emergency" ? "urgent" : "check", { ...detail, text }, sent);
}
