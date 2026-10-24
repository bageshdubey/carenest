/**
 * Flags a medicine whose name already appears, so the child can check before approving.
 * Exact names only: "TAB. Amlodipine 5mg" matches "Amlodipine", but a brand never matches
 * its generic. That would be a substitute judgement, which CareNest never makes.
 */
const FORM_WORDS = /^(tab|tabs|tablet|tablets|cap|caps|capsule|capsules|syp|syrup|inj|injection)\b\.?\s*/;
const STRENGTH = /\s*\d+(\.\d+)?\s*(mg|mcg|µg|g|ml|iu|units?)\b.*$/;

/** The part of a medicine name used to compare: lower case, without "Tab." and without a written strength. */
export function medicineKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}.\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(FORM_WORDS, "")
    .replace(STRENGTH, "")
    .replace(/\.$/, "")
    .trim();
}

export type DuplicateFlag<T> = { twiceInList: boolean; onList: T | null };

/**
 * For each row: does its name appear again in the same list, and is it already on the current list?
 * Rows without a name get no flag.
 */
export function findDuplicates<T extends { name: string }>(rows: { name: string }[], current: T[]): DuplicateFlag<T>[] {
  const keys = rows.map((r) => medicineKey(r.name));
  return keys.map((key) => ({
    twiceInList: !!key && keys.filter((k) => k === key).length > 1,
    onList: (key && current.find((m) => medicineKey(m.name) === key)) || null,
  }));
}
