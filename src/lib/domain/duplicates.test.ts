import { describe, expect, it } from "vitest";
import { findDuplicates, medicineKey } from "./duplicates";

describe("medicine names", () => {
  it("ignores case, form words, punctuation and a written strength", () => {
    expect(medicineKey("TAB. Amlodipine")).toBe("amlodipine");
    expect(medicineKey("Tab Amlodipine 5mg")).toBe("amlodipine");
    expect(medicineKey("  amlodipine  ")).toBe("amlodipine");
    expect(medicineKey("Syp. Benadryl 10 ml")).toBe("benadryl");
    expect(medicineKey("Metformin SR 500 mg")).toBe("metformin sr");
  });

  it("never treats a brand as its generic", () => {
    expect(medicineKey("Amlopress")).not.toBe(medicineKey("Amlodipine"));
  });
});

describe("duplicate flags", () => {
  const current = [{ name: "Amlodipine", strength: "5 mg" }];

  it("flags a new medicine already on the current list", () => {
    const flags = findDuplicates([{ name: "Tab. Amlodipine" }, { name: "Cough syrup" }], current);
    expect(flags[0].onList?.strength).toBe("5 mg");
    expect(flags[1].onList).toBeNull();
  });

  it("flags a name that appears twice in the same list", () => {
    const flags = findDuplicates([{ name: "Pantoprazole" }, { name: "PANTOPRAZOLE 40mg" }, { name: "Metformin" }], []);
    expect(flags.map((f) => f.twiceInList)).toEqual([true, true, false]);
  });

  it("ignores empty names", () => {
    expect(findDuplicates([{ name: "" }, { name: " " }], current)).toEqual([
      { twiceInList: false, onList: null },
      { twiceInList: false, onList: null },
    ]);
  });
});
