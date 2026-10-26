/**
 * Flags a medicine whose name already appears, so the child can check before approving.
 * Exact names only: "TAB. Amlodipine 5mg" matches "Amlodipine", but a brand never matches
 * its generic. That would be a substitute judgement, which CareNest never makes.
 */
const FORM_WORDS = /^(t|tab|tabs|tablet|tablets|c|cap|caps|capsule|capsules|syp|syrup|inj|injection)\b\.?\s*/;
/** A written strength, with or without a unit: "5mg", "500 mg", "Telma 40". The same medicine at two strengths is still a duplicate. */
const STRENGTH = /(\s*\d+(\.\d+)?\s*(mg|mcg|µg|g|ml|iu|units?)\b|\s+\d+(\.\d+)?\b).*$/;

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
