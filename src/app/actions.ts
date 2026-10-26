"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { AiBusyError, readDocument } from "@/lib/ai/gemini";
import { inWindow, sendMedicinePhotos, toParent } from "@/lib/bot/send";
import { admin } from "@/lib/db/admin";
import { activeMedicines, attachSamplePhotos, markAlertSeen, markNewListSeen, phoneInUse, savePrescription, uploadPhoto } from "@/lib/db/repo";
import { istNow, mealsInOrder } from "@/lib/domain/meals";
import { makeLinkCode, normalisePhone } from "@/lib/domain/safety";
import type { ChildLang, Food, MealKey, ParentLang } from "@/lib/domain/types";
import { listText, pm } from "@/lib/i18n/parent";
import { currentSession, requireFamily, supabaseServer } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

const PHONE = /^91\d{10}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export type SetupInput = {
  childName: string;
  callName: string;
  parentPhone: string;
  childLang: ChildLang;
  parentLang: ParentLang;
  meals: Record<MealKey, string>;
};

/** Creates the family after the setup wizard. */
export async function createFamily(input: SetupInput): Promise<ActionResult> {
  const { user, family } = await currentSession();
  if (!user) return { ok: false, error: "signin" };
  if (family) return { ok: true };

  const parentPhone = normalisePhone(input.parentPhone);
  if (!input.childName.trim() || !input.callName.trim()) return { ok: false, error: "name" };
  if (!PHONE.test(parentPhone)) return { ok: false, error: "phone" };
  if (!["en", "hi"].includes(input.childLang) || !["en", "hi", "mr"].includes(input.parentLang)) return { ok: false, error: "lang" };
  if (!Object.values(input.meals).every((t) => TIME.test(t)) || !mealsInOrder(input.meals)) return { ok: false, error: "meals" };
  if (await phoneInUse(parentPhone)) return { ok: false, error: "phoneTaken" };

  // The link code must be unique; try a few times on the rare clash.
  for (let attempt = 0; attempt < 5; attempt++) {
    const { error } = await admin().from("families").insert({
      owner_id: user.id,
      child_name: input.childName.trim(),
      child_lang: input.childLang,
      parent_call_name: input.callName.trim(),
      parent_phone: parentPhone,
      parent_lang: input.parentLang,
      meal_b: input.meals.b,
      meal_l: input.meals.l,
      meal_d: input.meals.d,
      link_code: makeLinkCode(),
    });
    if (!error) return { ok: true };
    if (error.message.includes("families_parent_phone_key")) return { ok: false, error: "phoneTaken" };
    if (error.code !== "23505" || error.message.includes("families_owner_idx")) return { ok: false, error: "save" };
  }
  return { ok: false, error: "save" };
}

/** Largest file the child can upload. Vercel refuses requests over 4.5 MB. */
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/**
 * The child adds a prescription photo from the web app.
 * Errors: "size" (over 4 MB), "busy" (Gemini stayed busy, try again), "read" (not read as a prescription).
 */
export async function uploadChildPrescription(formData: FormData): Promise<ActionResult> {
  const { family } = await requireFamily();
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "file" };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: "size" };
  const bytes = await file.arrayBuffer();
  const mime = file.type || "image/jpeg";
  try {
    const path = await uploadPhoto(family.id, bytes, mime);
    const result = await readDocument(bytes, mime);
    if (result.type !== "prescription") return { ok: false, error: "read" };
    const rxId = await savePrescription({
      familyId: family.id,
      source: "child",
      photoPath: path,
      doctor: result.doctor,
      date: result.date,
      extracted: result.raw,
      medicines: result.medicines,
    });
    await attachSamplePhotos(rxId);
  } catch (e) {
    if (e instanceof AiBusyError) return { ok: false, error: "busy" };
    console.error("Child prescription upload failed", e);
    return { ok: false, error: "read" };
  }
  revalidatePath("/home");
  return { ok: true };
}

/**
 * The child adds a photo of a medicine's strip, so the parent sees the real one in reminders.
 * It replaces any sample photo from the web. Errors: "file", "size", "save".
 */
export async function uploadStripPhoto(formData: FormData): Promise<ActionResult> {
  const { supabase, family } = await requireFamily();
  const medicineId = formData.get("medicineId");
  const file = formData.get("photo");
  if (typeof medicineId !== "string" || !UUID.test(medicineId)) return { ok: false, error: "save" };
  if (!(file instanceof File) || file.size === 0 || !file.type.startsWith("image/")) return { ok: false, error: "file" };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: "size" };
  const { data: med } = await supabase.from("medicines").select("id").eq("id", medicineId).eq("family_id", family.id).maybeSingle();
  if (!med) return { ok: false, error: "save" };
  try {
    const path = await uploadPhoto(family.id, await file.arrayBuffer(), file.type);
    const { error } = await supabase
      .from("medicines")
      .update({ photo_kind: "real", photo_path: path, photo_url: null, photo_source: null })
      .eq("id", medicineId);
    if (error) return { ok: false, error: "save" };
  } catch (e) {
    console.error("Strip photo upload failed", e);
    return { ok: false, error: "save" };
  }
  revalidatePath("/check");
  return { ok: true };
}

/** The child takes a wrong photo off a medicine. It then shows its name only, and is not searched again. */
export async function removeMedicinePhoto(medicineId: string): Promise<ActionResult> {
  const { supabase, family } = await requireFamily();
  if (!UUID.test(medicineId)) return { ok: false, error: "save" };
  const { error } = await supabase
    .from("medicines")
    .update({ photo_kind: null, photo_path: null, photo_url: null, photo_source: "removed" })
    .eq("id", medicineId)
    .eq("family_id", family.id);
  if (error) return { ok: false, error: "save" };
  revalidatePath("/check");
  return { ok: true };
}

const UUID = /^[0-9a-f-]{36}$/;
const FOODS: Food[] = ["before", "after", "any"];
const MEAL_KEYS: MealKey[] = ["b", "l", "d"];
/** Longest text in one field of a medicine, to refuse junk. The Check screen has the same limit. */
const TEXT_MAX = 200;

/**
 * Server actions can be called with any payload, not only what the form sends.
 * A long list still reaches the parent: toParent splits it into several WhatsApp messages.
 */
function validMedicine(m: EditedMedicine): boolean {
  const short = (s: unknown, max: number) => typeof s === "string" && s.length <= max;
  return (
    !!m &&
    (m.id === null || (typeof m.id === "string" && UUID.test(m.id))) &&
    short(m.name, TEXT_MAX) &&
    short(m.strength, TEXT_MAX) &&
    short(m.quantity, TEXT_MAX) &&
    short(m.purposeText, TEXT_MAX) &&
    typeof m.endsOn === "string" &&
    Array.isArray(m.meals) &&
    m.meals.every((k) => MEAL_KEYS.includes(k)) &&
    FOODS.includes(m.food) &&
    typeof m.asNeeded === "boolean" &&
    typeof m.purposeChanged === "boolean"
  );
}

export type EditedMedicine = {
  id: string | null;
  name: string;
  strength: string;
  quantity: string;
  meals: MealKey[];
  food: Food;
  purposeText: string;
  purposeChanged: boolean;
  /** Last day, "YYYY-MM-DD", or empty for no end. */
  endsOn: string;
  asNeeded: boolean;
};

/**
 * Approves a pending prescription (mode "pending") or saves edits to the
 * current list (mode "active"). Reminders only ever use approved medicines.
 * A medicine taken off the ongoing list is kept as stopped, for the history; one
 * removed from a prescription before it was approved was never taken, so it goes.
 * `stopIds`: ongoing medicines the child said were stopped when approving a new prescription.
 */
export async function saveList(mode: "pending" | "active", prescriptionId: string | null, meds: EditedMedicine[], stopIds: string[] = []): Promise<ActionResult> {
  const { supabase, family } = await requireFamily();
  if (!Array.isArray(meds) || !meds.every(validMedicine) || !Array.isArray(stopIds) || !stopIds.every((id) => UUID.test(id))) return { ok: false, error: "save" };
  if (prescriptionId !== null && !UUID.test(prescriptionId)) return { ok: false, error: "save" };
  const clean = meds.filter((m) => m.name.trim());
  if (clean.some((m) => !m.asNeeded && m.meals.length === 0)) return { ok: false, error: "meals" };
  if (clean.some((m) => m.endsOn && !ISO_DATE.test(m.endsOn))) return { ok: false, error: "endsOn" };

  const scope =
    mode === "pending" && prescriptionId
      ? supabase.from("medicines").select("id").eq("family_id", family.id).eq("prescription_id", prescriptionId)
      : supabase.from("medicines").select("id").eq("family_id", family.id).eq("active", true);
  const { data: existing, error: readErr } = await scope;
  if (readErr) return { ok: false, error: "save" };

  const keep = new Set(clean.map((m) => m.id).filter(Boolean) as string[]);
  const remove = (existing ?? []).map((r: { id: string }) => r.id).filter((id: string) => !keep.has(id));
  const stopped = { active: false, stopped_at: new Date().toISOString() };
  if (remove.length) {
    const { error } =
      mode === "active" ? await supabase.from("medicines").update(stopped).in("id", remove) : await supabase.from("medicines").delete().in("id", remove);
    if (error) return { ok: false, error: "save" };
  }
  if (mode === "pending" && stopIds.length) {
    const { error } = await supabase.from("medicines").update(stopped).eq("family_id", family.id).eq("active", true).in("id", stopIds);
    if (error) return { ok: false, error: "save" };
  }

  // All medicines at once: one round trip's wait instead of one per medicine.
  const results = await Promise.all(
    clean.map((m) => {
      const row: Record<string, unknown> = {
        name: m.name.trim(),
        strength: m.strength.trim(),
        quantity: m.quantity.trim() || "1 tablet",
        meals: m.asNeeded ? [] : m.meals,
        food: m.food,
        needs_check: false,
        active: true,
        ends_on: m.asNeeded ? null : m.endsOn || null,
        as_needed: m.asNeeded,
      };
      if (m.purposeChanged) {
        const t = m.purposeText.trim();
        row.purpose = t ? { en: t, hi: t, mr: t } : null;
        row.purpose_source = t ? "child" : "none";
      }
      return m.id
        ? supabase.from("medicines").update(row).eq("id", m.id)
        : supabase.from("medicines").insert({ ...row, family_id: family.id, prescription_id: prescriptionId, purpose: row.purpose ?? null, purpose_source: row.purpose_source ?? "none" });
    }),
  );
  if (results.some((r) => r.error)) return { ok: false, error: "save" };

  if (mode === "pending" && prescriptionId) {
    await supabase.from("prescriptions").update({ status: "approved", approved_at: new Date().toISOString() }).eq("id", prescriptionId);
    try {
      await markNewListSeen(family.id);
    } catch (e) {
      console.error("Could not mark the new-list alert as seen", e);
    }
  }

  // Tell the parent their checked list, if they are on WhatsApp and wrote in the last 24 hours
  // (outside that window WhatsApp drops a free message without telling us at once).
  // It goes after the reply, so the child does not wait for the voice note and WhatsApp.
  if (family.parent_linked_at && inWindow(family)) {
    after(async () => {
      try {
        const list = await activeMedicines(family.id);
        const lang = family.parent_lang;
        const vars = { n: family.parent_call_name, c: family.child_name };
        await sendMedicinePhotos(family, list);
        await toParent(family, `${pm(lang, "checked", vars)}\n\n${listText(lang, list)}\n\n${pm(lang, "footer")}`, [
          { id: "list", title: pm(lang, "q_list") },
          { id: "doc", title: pm(lang, "q_doc") },
        ]);
      } catch (e) {
        console.error("Could not send the checked list to the parent", e);
      }
    });
  }

  revalidatePath("/home");
  return { ok: true };
}

export async function updateSettings(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { supabase, family } = await requireFamily();
  const meals = { b: String(formData.get("meal_b")), l: String(formData.get("meal_l")), d: String(formData.get("meal_d")) };
  if (!Object.values(meals).every((t) => TIME.test(t)) || !mealsInOrder(meals)) return { ok: false, error: "meals" };
  const childLang = String(formData.get("child_lang"));
  const parentLang = String(formData.get("parent_lang"));
  if (!["en", "hi"].includes(childLang) || !["en", "hi", "mr"].includes(parentLang)) return { ok: false, error: "lang" };

  const { error } = await supabase
    .from("families")
    .update({ meal_b: meals.b, meal_l: meals.l, meal_d: meals.d, child_lang: childLang, parent_lang: parentLang })
    .eq("id", family.id);
  if (error) return { ok: false, error: "save" };
  revalidatePath("/home");
  return { ok: true };
}

/**
 * The child changes the parent's number. The old number's WhatsApp link ends at once; the parent
 * must send the new link from the new number. Medicines and history stay with the family.
 */
export async function changeParentPhone(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { family } = await requireFamily();
  const phone = normalisePhone(String(formData.get("parent_phone") ?? ""));
  if (!PHONE.test(phone)) return { ok: false, error: "phone" };
  if (phone === family.parent_phone) return { ok: true };
  if (await phoneInUse(phone, family.id)) return { ok: false, error: "phoneTaken" };

  const { error } = await admin()
    .from("families")
    .update({ parent_phone: phone, parent_linked_at: null, last_parent_message_at: null })
    .eq("id", family.id);
  if (error) return { ok: false, error: error.message.includes("families_parent_phone_key") ? "phoneTaken" : "save" };
  revalidatePath("/home");
  redirect("/setup");
}

/** "Got it" on an alert: hides it from Home and the bell. It stays in the Alerts tab. */
export async function dismissAlert(formData: FormData) {
  const { family } = await requireFamily();
  const id = String(formData.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/.test(id)) return;
  await markAlertSeen(family.id, id);
  revalidatePath("/home");
}

/** True once the parent has tapped the link and sent the message. The send screen asks every few seconds. */
export async function parentLinked(): Promise<boolean> {
  const { family } = await currentSession();
  return !!family?.parent_linked_at;
}

export async function signOut() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect("/");
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The child adds or changes the next visit. One upcoming visit per family: later ones are replaced. */
export async function saveVisit(formData: FormData) {
  const { supabase, family } = await requireFamily();
  const today = istNow().date;
  const date = String(formData.get("date") ?? "");
  const time = String(formData.get("time") ?? "");
  const doctor = String(formData.get("doctor") ?? "").trim().slice(0, 80);
  if (!ISO_DATE.test(date) || date < today) redirect("/home?visit=failed");
  const del = await supabase.from("visits").delete().eq("family_id", family.id).gte("visit_date", today);
  const ins = await supabase.from("visits").insert({
    family_id: family.id,
    visit_date: date,
    visit_time: TIME.test(time) ? time : null,
    doctor: doctor || null,
    source: "child",
    status: "confirmed",
  });
  if (del.error || ins.error) {
    console.error("Could not save the visit", del.error ?? ins.error);
    redirect("/home?visit=failed");
  }
  revalidatePath("/home");
  redirect("/home");
}

/** The child confirms a date found on a photo. It replaces any other upcoming visit. */
export async function confirmVisit(formData: FormData) {
  const { supabase, family } = await requireFamily();
  const id = String(formData.get("id") ?? "");
  const del = await supabase.from("visits").delete().eq("family_id", family.id).gte("visit_date", istNow().date).neq("id", id);
  const upd = await supabase.from("visits").update({ status: "confirmed" }).eq("family_id", family.id).eq("id", id);
  if (del.error || upd.error) redirect("/home?visit=failed");
  revalidatePath("/home");
}

export async function removeVisit(formData: FormData) {
  const { supabase, family } = await requireFamily();
  const { error } = await supabase.from("visits").delete().eq("family_id", family.id).eq("id", String(formData.get("id") ?? ""));
  if (error) redirect("/home?visit=failed");
  revalidatePath("/home");
}
