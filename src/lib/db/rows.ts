import type { ChildLang, Food, MealKey, MealTimes, Medicine, MedicinePhoto, ParentLang, Purpose, RangeFlag, ReportValue } from "@/lib/domain/types";

export type FamilyRow = {
  id: string;
  owner_id: string;
  child_name: string;
  child_lang: ChildLang;
  parent_call_name: string;
  parent_phone: string;
  parent_lang: ParentLang;
  meal_b: string;
  meal_l: string;
  meal_d: string;
  link_code: string;
  parent_linked_at: string | null;
  last_parent_message_at: string | null;
  created_at: string;
};

export type VisitRow = {
  id: string;
  family_id: string;
  visit_date: string;
  visit_time: string | null;
  doctor: string | null;
  source: "child" | "photo";
  status: "pending" | "confirmed";
  evening_sent_at: string | null;
  morning_sent_at: string | null;
  created_at: string;
};

export type MedicineRow = {
  id: string;
  family_id: string;
  prescription_id: string | null;
  name: string;
  strength: string;
  quantity: string;
  meals: string[];
  food: Food;
  purpose: Purpose | null;
  purpose_source: Medicine["purposeSource"];
  needs_check: boolean;
  active: boolean;
  created_at: string;
  /** Set when the child stops the medicine. Missing until migration 0006 has run. */
  stopped_at?: string | null;
  /** Last day of a course. Missing until migration 0007 has run. */
  ends_on?: string | null;
  /** "Only when needed" (SOS). Missing until migration 0007 has run. */
  as_needed?: boolean;
  /** "Once a week". Missing until migration 0012 has run. */
  weekly?: boolean;
  /** Picture of the medicine. Missing until migration 0011 has run. */
  photo_kind?: "real" | "sample" | null;
  photo_path?: string | null;
  photo_url?: string | null;
  photo_source?: string | null;
};

export type ReportValueRow = {
  id: string;
  report_id: string;
  test: string;
  value_text: string;
  value_number: number | null;
  unit: string | null;
  range_text: string | null;
  range_low: number | null;
  range_high: number | null;
  flag: RangeFlag;
  what_it_measures: Purpose | null;
};

export function mealTimes(f: FamilyRow): MealTimes {
  return { b: f.meal_b, l: f.meal_l, d: f.meal_d };
}

export function toMedicine(r: MedicineRow): Medicine {
  return {
    id: r.id,
    name: r.name,
    strength: r.strength,
    quantity: r.quantity,
    meals: r.meals.filter((m): m is MealKey => m === "b" || m === "l" || m === "d"),
    food: r.food,
    purpose: r.purpose,
    purposeSource: r.purpose_source,
    needsCheck: r.needs_check,
    endsOn: r.ends_on ?? null,
    asNeeded: r.as_needed ?? false,
    weekly: r.weekly ?? false,
    photo: toPhoto(r),
  };
}

function toPhoto(r: MedicineRow): MedicinePhoto | null {
  if (r.photo_kind === "real" && r.photo_path) return { kind: "real", path: r.photo_path, url: null, source: null };
  if (r.photo_kind === "sample" && r.photo_url) return { kind: "sample", path: null, url: r.photo_url, source: r.photo_source ?? null };
  return null;
}

export function fromMedicine(familyId: string, prescriptionId: string | null, m: Medicine) {
  return {
    family_id: familyId,
    prescription_id: prescriptionId,
    name: m.name,
    strength: m.strength,
    quantity: m.quantity,
    meals: m.meals,
    food: m.food,
    purpose: m.purpose,
    purpose_source: m.purposeSource,
    needs_check: m.needsCheck,
    ends_on: m.endsOn ?? null,
    as_needed: m.asNeeded ?? false,
    weekly: m.weekly ?? false,
  };
}

export function toReportValue(r: ReportValueRow): ReportValue {
  return {
    test: r.test,
    valueText: r.value_text,
    valueNumber: r.value_number,
    unit: r.unit,
    rangeText: r.range_text,
    rangeLow: r.range_low,
    rangeHigh: r.range_high,
    flag: r.flag,
    whatItMeasures: r.what_it_measures,
  };
}
