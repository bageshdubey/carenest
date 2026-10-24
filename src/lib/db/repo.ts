import "server-only";
import { LATER_MIN, MAX_LATER, type OpenDose } from "@/lib/domain/meals";
import type { MealKey, Medicine, ReportValue } from "@/lib/domain/types";
import { admin } from "./admin";
import { type FamilyRow, type MedicineRow, type ReportValueRow, type VisitRow, fromMedicine, toMedicine, toReportValue } from "./rows";

/** Server-side data access for the webhook and scheduler (service role). */

function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

/** The family this number last linked to. Newest wins, so an old setup with the same number never breaks it. */
export async function familyByParentPhone(phone: string): Promise<FamilyRow | null> {
  const res = await admin()
    .from("families")
    .select("*")
    .eq("parent_phone", phone)
    .not("parent_linked_at", "is", null)
    .order("parent_linked_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return must(res) as FamilyRow | null;
}

export async function familyByCode(code: string): Promise<FamilyRow | null> {
  return must(await admin().from("families").select("*").eq("link_code", code).maybeSingle()) as FamilyRow | null;
}

/** True if another family already uses this parent number. One number belongs to one child's account. */
export async function phoneInUse(phone: string, exceptFamilyId: string | null = null): Promise<boolean> {
  let query = admin().from("families").select("id", { count: "exact", head: true }).eq("parent_phone", phone);
  if (exceptFamilyId) query = query.neq("id", exceptFamilyId);
  const res = await query;
  if (res.error) throw new Error(res.error.message);
  return (res.count ?? 0) > 0;
}

export async function linkedFamilies(): Promise<FamilyRow[]> {
  return must(await admin().from("families").select("*").not("parent_linked_at", "is", null)) as FamilyRow[];
}

/** Links the parent's number to this family and unlinks it from any other family, so one number has one family. */
export async function markLinked(familyId: string, parentPhone: string) {
  must(await admin().from("families").update({ parent_linked_at: null }).eq("parent_phone", parentPhone).neq("id", familyId));
  must(await admin().from("families").update({ parent_linked_at: new Date().toISOString() }).eq("id", familyId));
}

export async function touchParent(familyId: string) {
  must(await admin().from("families").update({ last_parent_message_at: new Date().toISOString() }).eq("id", familyId));
}

export async function activeMedicines(familyId: string): Promise<Medicine[]> {
  const rows = must(await admin().from("medicines").select("*").eq("family_id", familyId).eq("active", true).order("created_at")) as MedicineRow[];
  return rows.map(toMedicine);
}

/**
 * Stops every approved medicine whose last day was before today. It stays in the history as stopped.
 * Returns the stopped medicines so the scheduler can tell each child.
 */
export async function stopEndedCourses(today: string): Promise<{ family_id: string; name: string; strength: string }[]> {
  const ended = must(
    await admin().from("medicines").select("id,family_id,name,strength").eq("active", true).not("ends_on", "is", null).lt("ends_on", today),
  ) as { id: string; family_id: string; name: string; strength: string }[];
  if (!ended.length) return [];
  const ids = ended.map((m) => m.id);
  must(await admin().from("medicines").update({ active: false, stopped_at: new Date().toISOString() }).in("id", ids));
  return ended;
}

export async function hasPendingPrescription(familyId: string): Promise<boolean> {
  const res = await admin().from("prescriptions").select("id", { count: "exact", head: true }).eq("family_id", familyId).eq("status", "pending");
  if (res.error) throw new Error(res.error.message);
  return (res.count ?? 0) > 0;
}

export async function uploadPhoto(familyId: string, bytes: ArrayBuffer, mimeType: string): Promise<string> {
  const ext = mimeType === "application/pdf" ? "pdf" : mimeType.split("/")[1] ?? "jpg";
  const path = `${familyId}/${Date.now()}.${ext}`;
  const res = await admin().storage.from("uploads").upload(path, bytes, { contentType: mimeType });
  if (res.error) throw new Error(res.error.message);
  return path;
}

export async function savePrescription(input: {
  familyId: string;
  source: "parent" | "child";
  photoPath: string | null;
  doctor: string | null;
  date: string | null;
  extracted: unknown;
  medicines: Medicine[];
}): Promise<string> {
  const rx = must(
    await admin()
      .from("prescriptions")
      .insert({ family_id: input.familyId, source: input.source, photo_path: input.photoPath, doctor: input.doctor, rx_date: input.date, extracted: input.extracted })
      .select("id")
      .single(),
  ) as { id: string };
  if (input.medicines.length) {
    must(await admin().from("medicines").insert(input.medicines.map((m) => fromMedicine(input.familyId, rx.id, m))));
  }
  return rx.id;
}

/** Previous value of each test, from the most recent earlier report, keyed by lower-case test name. */
export async function previousValues(familyId: string): Promise<Record<string, string>> {
  const reports = must(await admin().from("reports").select("id").eq("family_id", familyId).order("created_at", { ascending: false }).limit(1)) as { id: string }[];
  if (!reports.length) return {};
  const rows = must(await admin().from("report_values").select("test,value_text").eq("report_id", reports[0].id)) as { test: string; value_text: string }[];
  return Object.fromEntries(rows.map((r) => [r.test.toLowerCase(), r.value_text]));
}

export async function saveReport(input: { familyId: string; photoPath: string | null; lab: string | null; date: string | null; values: ReportValue[] }) {
  const rep = must(
    await admin().from("reports").insert({ family_id: input.familyId, photo_path: input.photoPath, lab: input.lab, report_date: input.date }).select("id").single(),
  ) as { id: string };
  if (input.values.length) {
    must(
      await admin()
        .from("report_values")
        .insert(
          input.values.map((v) => ({
            report_id: rep.id,
            test: v.test,
            value_text: v.valueText,
            value_number: v.valueNumber,
            unit: v.unit,
            range_text: v.rangeText,
            range_low: v.rangeLow,
            range_high: v.rangeHigh,
            flag: v.flag,
            what_it_measures: v.whatItMeasures,
          })),
        ),
    );
  }
  return rep.id;
}

export async function latestReportValues(familyId: string): Promise<ReportValue[]> {
  const reports = must(await admin().from("reports").select("id").eq("family_id", familyId).order("created_at", { ascending: false }).limit(1)) as { id: string }[];
  if (!reports.length) return [];
  const rows = must(await admin().from("report_values").select("*").eq("report_id", reports[0].id)) as ReportValueRow[];
  return rows.map(toReportValue);
}

export async function logMessage(familyId: string | null, direction: "in" | "out", body: string, waFrom: string | null, waMessageId: string | null) {
  const res = await admin().from("messages").insert({ family_id: familyId, direction, body, wa_from: waFrom, wa_message_id: waMessageId });
  // A duplicate incoming id means Meta retried a webhook we already handled.
  if (res.error && res.error.code === "23505") return false;
  if (res.error) throw new Error(res.error.message);
  return true;
}

/** After a voice note is understood, the Chat tab shows what was said instead of "[Voice]". */
export async function setMessageBody(waMessageId: string, body: string) {
  must(await admin().from("messages").update({ body }).eq("wa_message_id", waMessageId).eq("direction", "in"));
}

/** The next confirmed visit from today on, or null (also when it cannot be read, so the bot still answers). */
export async function nextVisit(familyId: string, today: string): Promise<VisitRow | null> {
  const res = await admin().from("visits").select("*").eq("family_id", familyId).eq("status", "confirmed").gte("visit_date", today).order("visit_date").limit(1).maybeSingle();
  if (res.error) console.error("Could not read the next visit", res.error.message);
  return (res.data as VisitRow | null) ?? null;
}

/** Confirmed visits on these dates, for the scheduler's reminders. */
export async function visitsOn(familyId: string, dates: string[]): Promise<VisitRow[]> {
  return must(await admin().from("visits").select("*").eq("family_id", familyId).eq("status", "confirmed").in("visit_date", dates)) as VisitRow[];
}

export async function markVisitReminded(visitId: string, which: "evening" | "morning") {
  must(await admin().from("visits").update({ [`${which}_sent_at`]: new Date().toISOString() }).eq("id", visitId));
}

/** A follow-up date read from a photo. It waits for the child's check; the same date is not added twice. */
export async function addPhotoVisit(familyId: string, date: string, time: string | null) {
  const existing = must(await admin().from("visits").select("id").eq("family_id", familyId).eq("visit_date", date)) as { id: string }[];
  if (existing.length) return;
  must(await admin().from("visits").insert({ family_id: familyId, visit_date: date, visit_time: time, source: "photo", status: "pending" }));
}

/** "Got it" on the dashboard. Only touches alerts of this family. */
export async function markAlertSeen(familyId: string, alertId: string) {
  must(await admin().from("alerts").update({ seen_at: new Date().toISOString() }).eq("id", alertId).eq("family_id", familyId).is("seen_at", null));
}

/** Once the child approves a list, its "new list" alerts are handled. */
export async function markNewListSeen(familyId: string) {
  must(await admin().from("alerts").update({ seen_at: new Date().toISOString() }).eq("family_id", familyId).eq("kind", "new_list").is("seen_at", null));
}

export async function addAlert(familyId: string, kind: string, severity: "check" | "urgent", detail: Record<string, unknown>, sentToWhatsapp: boolean) {
  must(await admin().from("alerts").insert({ family_id: familyId, kind, severity, detail, sent_to_whatsapp: sentToWhatsapp }));
}

export async function mealsSentToday(familyId: string, date: string): Promise<Set<MealKey>> {
  const rows = must(await admin().from("doses").select("meal").eq("family_id", familyId).eq("dose_date", date)) as { meal: MealKey }[];
  return new Set(rows.map((r) => r.meal));
}

export async function recordReminder(familyId: string, date: string, meal: MealKey) {
  must(await admin().from("doses").upsert({ family_id: familyId, dose_date: date, meal, status: "sent" }, { onConflict: "family_id,dose_date,meal", ignoreDuplicates: true }));
}

export async function markTaken(familyId: string, date: string, meal: MealKey): Promise<boolean> {
  const rows = must(
    await admin()
      .from("doses")
      .update({ status: "taken", taken_at: new Date().toISOString() })
      .eq("family_id", familyId)
      .eq("dose_date", date)
      .eq("meal", meal)
      .select("id"),
  ) as { id: string }[];
  return rows.length > 0;
}

export type OpenDoseRow = OpenDose & { id: string; family_id: string; dose_date: string; meal: MealKey };

export async function openDoses(): Promise<OpenDoseRow[]> {
  return must(
    await admin().from("doses").select("id,family_id,dose_date,meal,sent_at,reminded_at,later_until,followup_at").eq("status", "sent"),
  ) as OpenDoseRow[];
}

/**
 * The parent tapped "Later": the reminder comes again in 30 minutes, at most twice.
 * "closed" when the dose is already taken or not marked, "limit" after two Laters.
 */
export async function putOffDose(familyId: string, date: string, meal: MealKey, now: Date): Promise<{ result: "later"; until: Date } | { result: "limit" | "closed" }> {
  const dose = must(
    await admin().from("doses").select("id,status,later_count").eq("family_id", familyId).eq("dose_date", date).eq("meal", meal).maybeSingle(),
  ) as { id: string; status: string; later_count: number } | null;
  if (!dose || dose.status !== "sent") return { result: "closed" };
  if (dose.later_count >= MAX_LATER) return { result: "limit" };
  const until = new Date(now.getTime() + LATER_MIN * 60_000);
  must(await admin().from("doses").update({ later_count: dose.later_count + 1, later_until: until.toISOString() }).eq("id", dose.id).eq("status", "sent"));
  return { result: "later", until };
}

/**
 * Claims a due "Later" before the reminder goes again, so two overlapping runs never send it twice.
 * The resend starts a new hour: follow-up and "not marked" count from it.
 */
export async function claimResend(doseId: string, now: Date): Promise<boolean> {
  const rows = must(
    await admin()
      .from("doses")
      .update({ later_until: null, reminded_at: now.toISOString(), followup_at: null })
      .eq("id", doseId)
      .eq("status", "sent")
      .not("later_until", "is", null)
      .select("id"),
  ) as { id: string }[];
  return rows.length > 0;
}

/** Claims the one follow-up before it is sent. */
export async function claimFollowup(doseId: string, now: Date): Promise<boolean> {
  const rows = must(
    await admin().from("doses").update({ followup_at: now.toISOString() }).eq("id", doseId).eq("status", "sent").is("followup_at", null).select("id"),
  ) as { id: string }[];
  return rows.length > 0;
}

export async function markMissed(doseId: string) {
  must(await admin().from("doses").update({ status: "missed" }).eq("id", doseId).eq("status", "sent"));
}
