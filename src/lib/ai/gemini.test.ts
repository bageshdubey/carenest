import { describe, expect, it } from "vitest";
import { shiftDate } from "@/lib/domain/adherence";
import { istNow } from "@/lib/domain/meals";
import { toFollowUp } from "./gemini";

describe("follow-up date from a document", () => {
  const today = istNow().date;

  it('counts "after N days" from the prescription date, not from today', () => {
    const rxDate = shiftDate(today, -3);
    expect(toFollowUp({ date: null, after_days: 7, time: null }, rxDate)).toEqual({ date: shiftDate(today, 4), time: null });
  });

  it("drops a follow-up that is already past on an old slip", () => {
    expect(toFollowUp({ date: null, after_days: 7, time: null }, shiftDate(today, -21))).toBeNull();
  });

  it("counts from today when the document has no date", () => {
    expect(toFollowUp({ date: null, after_days: 14, time: "10:30" })).toEqual({ date: shiftDate(today, 14), time: "10:30" });
  });

  it("ignores impossible dates instead of failing", () => {
    expect(toFollowUp({ date: "2099-13-01", after_days: null, time: null })).toBeNull();
    expect(toFollowUp({ date: null, after_days: 7, time: null }, "2026-00-10")).toEqual({ date: shiftDate(today, 7), time: null });
  });
});
