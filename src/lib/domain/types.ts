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
};

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
