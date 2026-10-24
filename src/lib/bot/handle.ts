import "server-only";
import { AiBusyError, type Understood, readDocument, understand } from "@/lib/ai/gemini";
import {
  activeMedicines,
  addPhotoVisit,
  familyByCode,
  familyByParentPhone,
  hasPendingPrescription,
  latestReportValues,
  logMessage,
  markLinked,
  markTaken,
  nextVisit,
  previousValues,
  putOffDose,
  savePrescription,
  saveReport,
  setMessageBody,
  touchParent,
  uploadPhoto,
} from "@/lib/db/repo";
import type { FamilyRow } from "@/lib/db/rows";
import { isOutOfRange } from "@/lib/domain/report";
import { findLinkCode, isEmergency } from "@/lib/domain/safety";
import { istClock, istNow } from "@/lib/domain/meals";
import type { MealKey } from "@/lib/domain/types";
import { doctorQuestions, listText, mealName, pm, reminderLines, reportText, visitText } from "@/lib/i18n/parent";
import { downloadMedia, sendText } from "@/lib/whatsapp/client";
import type { Incoming } from "@/lib/whatsapp/webhook";
import { alertChild, toParent } from "./send";

const v = (f: FamilyRow) => ({ n: f.parent_call_name, c: f.child_name });

/** Runs an AI call. If it fails for any reason, asks the parent to send again (never silence) and returns null. */
async function orBusy<T>(family: FamilyRow, call: () => Promise<T>): Promise<T | null> {
  try {
    return await call();
  } catch (e) {
    if (!(e instanceof AiBusyError)) console.error("AI call failed", e);
    await toParent(family, pm(family.parent_lang, "busy", v(family)), [], null);
    return null;
  }
}

function menu(f: FamilyRow) {
  return [
    { id: "list", title: pm(f.parent_lang, "q_list") },
    { id: "doc", title: pm(f.parent_lang, "q_doc") },
  ];
}

/** Handles one incoming WhatsApp message from start to finish. */
export async function handleIncoming(msg: Incoming) {
  let family = await familyByParentPhone(msg.from);

  // Not linked yet: the first message must carry the family's link code.
  if (!family) {
    const code = msg.kind === "text" ? findLinkCode(msg.text) : null;
    const candidate = code ? await familyByCode(code) : null;
    const isNew = await logMessage(candidate?.id ?? null, "in", describe(msg), msg.from, msg.id);
    if (!isNew) return;
    if (!candidate) {
      await sendText(msg.from, pm("en", "unknownNumber"));
      return;
    }
    if (candidate.parent_phone !== msg.from) {
      await sendText(msg.from, pm(candidate.parent_lang, "wrongNumber"));
      return;
    }
    await markLinked(candidate.id, candidate.parent_phone);
    await touchParent(candidate.id);
    family = { ...candidate, last_parent_message_at: new Date().toISOString() };
    await toParent(family, pm(family.parent_lang, "welcome", v(family)));
    const meds = await activeMedicines(family.id);
    if (meds.length) {
      await toParent(family, `${pm(family.parent_lang, "already", v(family))}\n\n${listText(family.parent_lang, meds)}\n\n${pm(family.parent_lang, "footer")}`, menu(family));
    }
    return;
  }

  const isNew = await logMessage(family.id, "in", describe(msg), msg.from, msg.id);
  if (!isNew) return;
  await touchParent(family.id);
  family = { ...family, last_parent_message_at: new Date().toISOString() };
  const lang = family.parent_lang;

  if (msg.kind === "media") return handleDocument(family, msg.mediaId, msg.mimeType);

  if (msg.kind === "button") return handleButton(family, msg.buttonId);

  if (msg.kind === "text") {
    const text = msg.text.trim();
    if (isEmergency(text)) return emergency(family, text);
    if (findLinkCode(text)) {
      await toParent(family, pm(lang, "help", v(family)), menu(family));
      return;
    }
    const meds = await activeMedicines(family.id);
    const understood = await orBusy(family, () => understand({ text }, meds, lang));
    if (understood) await reply(family, understood, false);
    return;
  }

  if (msg.kind === "voice") {
    const meds = await activeMedicines(family.id);
    const understood = await orBusy(family, async () => {
      const { bytes, mimeType } = await downloadMedia(msg.mediaId);
      return understand({ audio: bytes, mimeType: mimeType || msg.mimeType }, meds, lang);
    });
    if (!understood) return;
    await setMessageBody(msg.id, understood.heard ? `[Voice] ${understood.heard}` : "[Voice]");
    // Emergency words are checked in code on what was said, before any other reply.
    if (understood.heard && isEmergency(understood.heard)) return emergency(family, understood.heard);
    await reply(family, understood, true);
    return;
  }

  await toParent(family, pm(lang, "help", v(family)), menu(family));
}

async function emergency(family: FamilyRow, said: string) {
  await toParent(family, pm(family.parent_lang, "emergency", v(family)));
  await alertChild(family, "emergency", { q: said });
}

/**
 * Answers a typed or spoken message from the parent's own data. Gemini only picked the kind of
 * question; the reply text is built here, so it never goes beyond the list, the report and the visit.
 * A voice question gets "You asked: …" above the text so a mishearing is visible; the voice reads only the answer.
 */
async function reply(family: FamilyRow, u: Understood, fromVoice: boolean) {
  const lang = family.parent_lang;
  const vars = v(family);
  const send = (answer: string, buttons = menu(family)) =>
    toParent(family, fromVoice && u.heard ? `${pm(lang, "youAsked", { q: u.heard })}\n\n${answer}` : answer, buttons, answer);

  if (u.intent === "advice") {
    await send(pm(lang, "fixed", vars), []);
    await alertChild(family, "advice_question", { q: u.heard });
    return;
  }
  if (u.intent === "next_visit") {
    const visit = await nextVisit(family.id, istNow().date);
    await send(visit ? visitText(lang, "visitNext", visit, vars) : pm(lang, "visitNone", vars));
    return;
  }
  if (u.intent === "report") {
    const values = await latestReportValues(family.id);
    await send(values.length ? reportText(lang, vars, values, {}) : pm(lang, "noReport", vars), [{ id: "doc", title: pm(lang, "q_doc") }]);
    return;
  }
  if (u.intent === "greeting" || u.intent === "other") {
    await send(pm(lang, "help", vars));
    return;
  }

  // Everything left is about the medicine list.
  const meds = await activeMedicines(family.id);
  if (!meds.length) {
    const pending = await hasPendingPrescription(family.id);
    await send(pm(lang, pending ? "waiting" : "noList", vars), []);
    return;
  }
  const footer = pm(lang, "footer");
  if (u.intent === "meds_for_meal" && u.meal) {
    const lines = reminderLines(lang, u.meal, meds);
    const meal = mealName(lang, u.meal);
    await send(lines ? `${pm(lang, "mealMeds", { ...vars, meal, lines })}\n\n${footer}` : pm(lang, "noMealMeds", { ...vars, meal }));
  } else if (u.intent === "meds_count") {
    await send(`${pm(lang, "medCount", { ...vars, k: String(meds.length), names: meds.map((m) => m.name.trim()).join(", ") })}\n\n${footer}`);
  } else if (u.intent === "about_my_medicines" && u.answer) {
    await send(`${u.answer}\n\n${footer}`);
  } else {
    await send(`${listText(lang, meds)}\n\n${footer}`);
  }
}

async function handleDocument(family: FamilyRow, mediaId: string, mimeType: string) {
  const lang = family.parent_lang;
  const media = await orBusy(family, async () => {
    const { bytes, mimeType: mime } = await downloadMedia(mediaId);
    return { bytes, mime: mime || mimeType, photoPath: await uploadPhoto(family.id, bytes, mime || mimeType) };
  });
  if (!media) return;
  const { bytes, mime, photoPath } = media;
  const result = await orBusy(family, () => readDocument(bytes, mime));
  if (!result) return;

  // A follow-up date on the photo becomes a visit waiting for the child's check.
  if ((result.type === "prescription" || result.type === "lab_report") && result.followUp) {
    try {
      await addPhotoVisit(family.id, result.followUp.date, result.followUp.time);
    } catch (e) {
      console.error("Could not save the follow-up date", e);
    }
  }

  if (result.type === "prescription") {
    await savePrescription({
      familyId: family.id,
      source: "parent",
      photoPath,
      doctor: result.doctor,
      date: result.date,
      extracted: result.raw,
      medicines: result.medicines,
    });
    await toParent(family, pm(lang, "gotRx", v(family)));
    await alertChild(family, "new_list");
    return;
  }

  if (result.type === "lab_report") {
    const last = await previousValues(family.id);
    await saveReport({ familyId: family.id, photoPath, lab: result.lab, date: result.date, values: result.values });
    await toParent(family, reportText(lang, v(family), result.values, last), [{ id: "doc", title: pm(lang, "q_doc") }]);
    const out = result.values.filter((x) => isOutOfRange(x.flag)).length;
    if (out) await alertChild(family, "report_out_of_range", { k: out });
    return;
  }

  await toParent(family, pm(lang, result.type === "unreadable" ? "unclearPhoto" : "notADoc", v(family)));
}

async function handleButton(family: FamilyRow, buttonId: string) {
  const lang = family.parent_lang;
  if (buttonId.startsWith("taken:")) {
    const [, date, meal] = buttonId.split(":");
    await markTaken(family.id, date, meal as MealKey);
    await toParent(family, pm(lang, "thanks", v(family)));
    return;
  }
  if (buttonId.startsWith("later:")) {
    const [, date, meal] = buttonId.split(":");
    const res = await putOffDose(family.id, date, meal as MealKey, new Date());
    if (res.result === "later") {
      await toParent(family, pm(lang, "laterOk", { ...v(family), t: istClock(res.until) }));
    } else {
      await toParent(family, pm(lang, res.result === "limit" ? "laterLimit" : "laterClosed", v(family)));
    }
    return;
  }
  if (buttonId === "list") {
    const meds = await activeMedicines(family.id);
    await toParent(family, meds.length ? `${listText(lang, meds)}\n\n${pm(lang, "footer")}` : pm(lang, "noList", v(family)));
    return;
  }
  if (buttonId === "doc") {
    const values = await latestReportValues(family.id);
    await toParent(family, doctorQuestions(lang, family.child_name, values));
    return;
  }
  await toParent(family, pm(lang, "help", v(family)), menu(family));
}

function describe(msg: Incoming): string {
  switch (msg.kind) {
    case "text":
      return msg.text;
    case "media":
      return msg.mimeType === "application/pdf" ? "[PDF]" : "[Photo]";
    case "voice":
      return "[Voice]";
    case "button":
      return msg.title;
    default:
      return `[${msg.type}]`;
  }
}
