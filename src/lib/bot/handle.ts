import "server-only";
import { answerQuestion, readDocument } from "@/lib/ai/claude";
import {
  activeMedicines,
  familyByCode,
  familyByParentPhone,
  hasPendingPrescription,
  latestReportValues,
  logMessage,
  markLinked,
  markTaken,
  previousValues,
  savePrescription,
  saveReport,
  touchParent,
  uploadPhoto,
} from "@/lib/db/repo";
import type { FamilyRow } from "@/lib/db/rows";
import { isOutOfRange } from "@/lib/domain/report";
import { findLinkCode, isEmergency } from "@/lib/domain/safety";
import type { MealKey } from "@/lib/domain/types";
import { doctorQuestions, listText, pm, reportText } from "@/lib/i18n/parent";
import { downloadMedia, sendText } from "@/lib/whatsapp/client";
import type { Incoming } from "@/lib/whatsapp/webhook";
import { alertChild, toParent } from "./send";

const v = (f: FamilyRow) => ({ n: f.parent_call_name, c: f.child_name, p: f.child_phone ?? "" });

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
    await markLinked(candidate.id);
    await touchParent(candidate.id);
    family = candidate;
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
  const lang = family.parent_lang;

  if (msg.kind === "media") return handleDocument(family, msg.mediaId, msg.mimeType);

  if (msg.kind === "button") return handleButton(family, msg.buttonId);

  if (msg.kind === "text") {
    const text = msg.text.trim();
    if (isEmergency(text)) {
      await toParent(family, pm(lang, "emergency", v(family)));
      await alertChild(family, "emergency", { q: text });
      return;
    }
    if (findLinkCode(text)) {
      await toParent(family, pm(lang, "help", v(family)), menu(family));
      return;
    }
    const meds = await activeMedicines(family.id);
    if (!meds.length) {
      const pending = await hasPendingPrescription(family.id);
      await toParent(family, pm(lang, pending ? "waiting" : "noList", v(family)));
      return;
    }
    const { intent, answer } = await answerQuestion(text, meds, lang);
    if (intent === "about_my_medicines" && answer) {
      await toParent(family, `${answer}\n\n${pm(lang, "footer")}`, menu(family));
    } else if (intent === "advice") {
      await toParent(family, pm(lang, "fixed", v(family)));
      await alertChild(family, "advice_question", { q: text });
    } else {
      await toParent(family, pm(lang, "help", v(family)), menu(family));
    }
    return;
  }

  await toParent(family, pm(lang, "help", v(family)), menu(family));
}

async function handleDocument(family: FamilyRow, mediaId: string, mimeType: string) {
  const lang = family.parent_lang;
  const { bytes, mimeType: mime } = await downloadMedia(mediaId);
  const photoPath = await uploadPhoto(family.id, bytes, mime || mimeType);
  const result = await readDocument(bytes, mime || mimeType);

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
    await toParent(family, reportText(lang, family.parent_call_name, result.values, last), [{ id: "doc", title: pm(lang, "q_doc") }]);
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
    case "button":
      return msg.title;
    default:
      return `[${msg.type}]`;
  }
}
