"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { readDocument } from "@/lib/ai/gemini";
import { toParent } from "@/lib/bot/send";
import { markAlertSeen, markNewListSeen, savePrescription, uploadPhoto } from "@/lib/db/repo";
import { toMedicine } from "@/lib/db/rows";
import { istNow, mealsInOrder } from "@/lib/domain/meals";
import { makeLinkCode, normalisePhone } from "@/lib/domain/safety";
import type { ChildLang, Food, MealKey, Medicine, ParentLang } from "@/lib/domain/types";
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
  const { supabase, user, family } = await currentSession();
  if (!user) return { ok: false, error: "signin" };
  if (family) return { ok: true };

  const parentPhone = normalisePhone(input.parentPhone);
  if (!input.childName.trim() || !input.callName.trim()) return { ok: false, error: "name" };
  if (!PHONE.test(parentPhone)) return { ok: false, error: "phone" };
  if (!["en", "hi"].includes(input.childLang) || !["en", "hi", "mr"].includes(input.parentLang)) return { ok: false, error: "lang" };
  if (!Object.values(input.meals).every((t) => TIME.test(t)) || !mealsInOrder(input.meals)) return { ok: false, error: "meals" };

  // The link code must be unique; try a few times on the rare clash.
  for (let attempt = 0; attempt < 5; attempt++) {
    const { error } = await supabase.from("families").insert({
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
    if (error.code !== "23505" || error.message.includes("families_owner_idx")) return { ok: false, error: "save" };
  }
  return { ok: false, error: "save" };
}

/** The child adds a prescription photo from the web app. */
export async function uploadChildPrescription(formData: FormData): Promise<ActionResult> {
  const { family } = await requireFamily();
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "file" };
  if (file.size > 10 * 1024 * 1024) return { ok: false, error: "size" };
  const bytes = await file.arrayBuffer();
  const mime = file.type || "image/jpeg";
  try {
    const path = await uploadPhoto(family.id, bytes, mime);
    const result = await readDocument(bytes, mime);
    if (result.type !== "prescription") return { ok: false, error: "read" };
    await savePrescription({
      familyId: family.id,
      source: "child",
      photoPath: path,
      doctor: result.doctor,
      date: result.date,
      extracted: result.raw,
      medicines: result.medicines,
    });
  } catch (e) {
    console.error("Child prescription upload failed", e);
    return { ok: false, error: "read" };
  }
  revalidatePath("/home");
  return { ok: true };
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
};

/**
 * Approves a pending prescription (mode "pending") or saves edits to the
 * current list (mode "active"). Reminders only ever use approved medicines.
 */
export async function saveList(mode: "pending" | "active", prescriptionId: string | null, meds: EditedMedicine[]): Promise<ActionResult> {
  const { supabase, family } = await requireFamily();
  const clean = meds.filter((m) => m.name.trim());
  if (clean.some((m) => m.meals.length === 0)) return { ok: false, error: "meals" };

  const scope =
    mode === "pending" && prescriptionId
      ? supabase.from("medicines").select("id").eq("family_id", family.id).eq("prescription_id", prescriptionId)
      : supabase.from("medicines").select("id").eq("family_id", family.id).eq("active", true);
  const { data: existing, error: readErr } = await scope;
  if (readErr) return { ok: false, error: "save" };

  const keep = new Set(clean.map((m) => m.id).filter(Boolean) as string[]);
  const remove = (existing ?? []).map((r: { id: string }) => r.id).filter((id: string) => !keep.has(id));
  if (remove.length) {
    const { error } = await supabase.from("medicines").delete().in("id", remove);
    if (error) return { ok: false, error: "save" };
  }

  for (const m of clean) {
    const row: Record<string, unknown> = {
      name: m.name.trim(),
      strength: m.strength.trim(),
      quantity: m.quantity.trim() || "1 tablet",
      meals: m.meals,
      food: m.food,
      needs_check: false,
      active: true,
    };
    if (m.purposeChanged) {
      const t = m.purposeText.trim();
      row.purpose = t ? { en: t, hi: t, mr: t } : null;
      row.purpose_source = t ? "child" : "none";
    }
    const { error } = m.id
      ? await supabase.from("medicines").update(row).eq("id", m.id)
      : await supabase.from("medicines").insert({ ...row, family_id: family.id, prescription_id: prescriptionId, purpose: row.purpose ?? null, purpose_source: row.purpose_source ?? "none" });
    if (error) return { ok: false, error: "save" };
  }

  if (mode === "pending" && prescriptionId) {
    await supabase.from("prescriptions").update({ status: "approved", approved_at: new Date().toISOString() }).eq("id", prescriptionId);
    try {
      await markNewListSeen(family.id);
    } catch (e) {
      console.error("Could not mark the new-list alert as seen", e);
    }
  }

  // Tell the parent their checked list, if they are already on WhatsApp.
  if (family.parent_linked_at) {
    try {
      const { data } = await supabase.from("medicines").select("*").eq("family_id", family.id).eq("active", true).order("created_at");
      const list: Medicine[] = (data ?? []).map(toMedicine);
      const lang = family.parent_lang;
      const vars = { n: family.parent_call_name, c: family.child_name };
      await toParent(family, `${pm(lang, "checked", vars)}\n\n${listText(lang, list)}\n\n${pm(lang, "footer")}`, [
        { id: "list", title: pm(lang, "q_list") },
        { id: "doc", title: pm(lang, "q_doc") },
      ]);
    } catch (e) {
      console.error("Could not send the checked list to the parent", e);
    }
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

/** "Got it" on an alert: hides it from Home and the bell. It stays in the Alerts tab. */
export async function dismissAlert(formData: FormData) {
  const { family } = await requireFamily();
  const id = String(formData.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/.test(id)) return;
  await markAlertSeen(family.id, id);
  revalidatePath("/home");
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
