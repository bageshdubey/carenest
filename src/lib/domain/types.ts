export type ParentLang = "en" | "hi" | "mr";
export type ChildLang = "en" | "hi";
export type MealKey = "b" | "l" | "d";
export type Food = "before" | "after" | "any";

export const MEALS: MealKey[] = ["b", "l", "d"];

/** "HH:MM", 24-hour, India time. */
export type MealTimes = Record<MealKey, string>;

export type Purpose = { en: string; hi: string; mr: string };

export type Medicine = {
  id?: string;
  name: string;
  strength: string;
  quantity: string;
  meals: MealKey[];
  food: Food;
  purpose: Purpose | null;
  purposeSource: "prescription" | "suggested" | "child" | "none";
  needsCheck: boolean;
  /** Last day of a course, "YYYY-MM-DD". Missing or null: no end. */
  endsOn?: string | null;
  /** "Only when needed" (SOS): on the list, never reminded. */
  asNeeded?: boolean;
  /** "Once a week": on the list, never in a daily meal reminder. */
  weekly?: boolean;
  /** What the medicine looks like, so a parent who can't read the name can find the strip. */
  photo?: MedicinePhoto | null;
};

/**
 * "real": the child's photo of the strip (`path` in the private uploads bucket).
 * "sample": a photo found on the web for the name (`url`), which may not match the parent's strip.
 */
export type MedicinePhoto = { kind: "real" | "sample"; path: string | null; url: string | null; source: string | null };

export type DoseStatus = "sent" | "taken" | "missed";

export type RangeFlag = "high" | "low" | "in_range" | "unknown";

export type ReportValue = {
  test: string;
  valueText: string;
  valueNumber: number | null;
  unit: string | null;
  rangeText: string | null;
  rangeLow: number | null;
  rangeHigh: number | null;
  flag: RangeFlag;
  whatItMeasures: Purpose | null;
};
