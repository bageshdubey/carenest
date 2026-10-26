import { describe, expect, it } from "vitest";
import { dueReminders, formatTime, isOverdue, istNow, mealsInOrder } from "./meals";
import { flagValue, parseRange } from "./report";
import { findLinkCode, isEmergency, normalisePhone } from "./safety";
import type { Medicine } from "./types";
import { doctorQuestions, listText, reminderLines } from "@/lib/i18n/parent";

const med = (name: string, meals: Medicine["meals"], food: Medicine["food"] = "after"): Medicine => ({
  name,
  strength: "5 mg",
  quantity: "1 tablet",
  meals,
  food,
  purpose: { en: "Blood pressure", hi: "रक्तचाप", mr: "रक्तदाब" },
  purposeSource: "prescription",
  needsCheck: false,
});

// 13:40 India time on 21 Oct 2026 = 08:10 UTC
const at = (utc: string) => new Date(`2026-10-21T${utc}:00Z`);

describe("meals", () => {
  it("converts to India time", () => {
    expect(istNow(at("08:10"))).toEqual({ date: "2026-10-21", minutes: 13 * 60 + 40 });
    expect(istNow(at("20:00")).date).toBe("2026-10-22");
  });
  it("checks meal order", () => {
    expect(mealsInOrder({ b: "08:30", l: "13:30", d: "20:30" })).toBe(true);
    expect(mealsInOrder({ b: "08:30", l: "07:30", d: "20:30" })).toBe(false);
  });
  it("finds due reminders only inside the window and only for meals with tablets", () => {
    const times = { b: "08:30", l: "13:30", d: "20:30" };
    const meds = [med("Amlodipine", ["b"]), med("Metformin", ["l", "d"])];
    expect(dueReminders(times, meds, new Set(), at("08:10"))).toEqual(["l"]);
    expect(dueReminders(times, meds, new Set(["l"]), at("08:10"))).toEqual([]);
    expect(dueReminders(times, [med("Amlodipine", ["b"])], new Set(), at("08:10"))).toEqual([]);
    // 14:45 IST is past the 60-minute window
    expect(dueReminders(times, meds, new Set(), at("09:15"))).toEqual([]);
  });
  it("marks overdue after 60 minutes", () => {
    expect(isOverdue(at("08:00"), at("08:59"))).toBe(false);
    expect(isOverdue(at("08:00"), at("09:00"))).toBe(true);
  });
  it("formats times", () => {
    expect(formatTime("08:30")).toBe("8:30 am");
    expect(formatTime("13:05")).toBe("1:05 pm");
    expect(formatTime("00:15")).toBe("12:15 am");
  });
});

describe("report ranges", () => {
  it("reads printed ranges", () => {
    expect(parseRange("4.0 - 5.6 %")).toEqual({ low: 4, high: 5.6 });
    expect(parseRange("70-100 mg/dL")).toEqual({ low: 70, high: 100 });
    expect(parseRange("12.0 to 15.5")).toEqual({ low: 12, high: 15.5 });
    expect(parseRange("< 200")).toEqual({ low: null, high: 200 });
    expect(parseRange("Up to 5.7")).toEqual({ low: null, high: 5.7 });
    expect(parseRange("> 40")).toEqual({ low: 40, high: null });
    expect(parseRange("1,000 - 4,000")).toEqual({ low: 1000, high: 4000 });
    expect(parseRange("Negative")).toEqual({ low: null, high: null });
  });
  it("gives no range when several are printed, instead of picking one", () => {
    for (const r of [
      "Male: 13.0-17.0 Female: 12.0-15.0",
      "Desirable: <200 Borderline: 200-239 High: >=240",
      "Normal: <100, Prediabetes: 100-125, Diabetes: >=126",
    ]) {
      expect(parseRange(r), r).toEqual({ low: null, high: null });
    }
    expect(parseRange("Non-diabetic: < 5.7 %")).toEqual({ low: null, high: 5.7 });
    expect(parseRange("4.0 - 11.0 x10^3/uL")).toEqual({ low: 4, high: 11 });
  });
  it("flags values in code", () => {
    expect(flagValue(7.2, 4, 5.6)).toBe("high");
    expect(flagValue(3.1, 4, 5.6)).toBe("low");
    expect(flagValue(5.6, 4, 5.6)).toBe("in_range");
    expect(flagValue(180, null, 200)).toBe("in_range");
    expect(flagValue(null, 4, 5.6)).toBe("unknown");
    expect(flagValue(5, null, null)).toBe("unknown");
  });
});

describe("safety", () => {
  it("catches emergency words in English, Hindi and Marathi", () => {
    for (const t of ["I fell, my knee hurts", "chest pain since morning", "I can't breathe", "मैं गिर गई", "सीने में दर्द है", "main gir gayi", "मी पडले"]) {
      expect(isEmergency(t), t).toBe(true);
    }
  });
  it("does not flag normal questions", () => {
    for (const t of ["What is Amlodipine for?", "Hi", "I fell asleep early", "can I skip this today?"]) {
      expect(isEmergency(t), t).toBe(false);
    }
  });
  it("does not flag a thing that fell, or falling ill", () => {
    for (const t of [
      "मेरा चश्मा गिर गया था, दवाई की लिस्ट फिर से भेजो",
      "गोली नीचे गिर गई",
      "mera phone gir gaya",
      "goli niche gir gayi",
      "मी मागच्या आठवड्यात आजारी पडले होते, माझी औषधांची यादी पाठवा",
      "मी सकाळी बाहेर पडले होते",
    ]) {
      expect(isEmergency(t), t).toBe(false);
    }
  });
  it("still catches a person falling next to those words", () => {
    for (const t of [
      "मैं गिर गया",
      "चश्मा उठाते हुए मैं गिर गई",
      "फोन गिर गया और मैं भी गिर गई",
      "main bathroom mein gir gaya",
      "मी बाथरूममध्ये पडले",
      "आजारी होते आणि मी पडले",
    ]) {
      expect(isEmergency(t), t).toBe(true);
    }
  });
  it("catches breathing, chest, overdose and self-harm words", () => {
    for (const t of [
      "I can’t breathe",
      "difficulty breathing since night",
      "my chest hurts",
      "chest is very tight",
      "छाती में बहुत दर्द है",
      "I took my tablets twice by mistake",
      "took the bp tablet double",
      "overdose",
      "I want to die",
      "photo of my phone fell and Papa fell too",
    ]) {
      expect(isEmergency(t), t).toBe(true);
    }
  });
  it("does not flag a thing that fell, falling ill, no pain, or finding something", () => {
    for (const t of ["my phone fell", "the tablet fell under the bed", "I fell ill last week", "no chest pain today, feeling good", "गोळी सापडली", "माझा चष्मा सापडला"]) {
      expect(isEmergency(t), t).toBe(false);
    }
  });
  it("normalises Indian numbers", () => {
    expect(normalisePhone("98765 43210")).toBe("919876543210");
    expect(normalisePhone("+91 98765-43210")).toBe("919876543210");
    expect(normalisePhone("09876543210")).toBe("919876543210");
  });
  it("finds link codes", () => {
    expect(findLinkCode("Hi CareNest cn-4821")).toBe("CN-4821");
    expect(findLinkCode("Hi")).toBeNull();
    expect(findLinkCode("Hi CareNest CN 4821")).toBe("CN-4821");
    expect(findLinkCode("cn4821")).toBe("CN-4821");
    expect(findLinkCode("CN–4821")).toBe("CN-4821");
    expect(findLinkCode("CN-48210")).toBeNull();
  });
});

describe("parent messages", () => {
  const meds = [med("Amlodipine", ["b"]), med("Metformin", ["l", "d"], "after"), med("Pantoprazole", ["b"], "before")];
  it("groups the list by meal", () => {
    const t = listText("en", meds);
    expect(t).toContain("Breakfast:");
    expect(t).toContain("Lunch:");
    expect(t.indexOf("Breakfast")).toBeLessThan(t.indexOf("Dinner"));
  });
  it("splits a reminder into before and after food", () => {
    const t = reminderLines("en", "b", meds);
    expect(t.indexOf("Before food")).toBeLessThan(t.indexOf("After food"));
    expect(t).toContain("Pantoprazole");
  });
  it("writes Hindi reminders with the Hindi purpose", () => {
    expect(reminderLines("hi", "b", meds)).toContain("रक्तचाप के लिए");
  });
  it("builds doctor questions only from out-of-range values", () => {
    const q = doctorQuestions("en", "Rohan", [
      { test: "HbA1c", valueText: "7.2 %", valueNumber: 7.2, unit: "%", rangeText: "4.0 - 5.6", rangeLow: 4, rangeHigh: 5.6, flag: "high", whatItMeasures: null },
      { test: "Haemoglobin", valueText: "12.9", valueNumber: 12.9, unit: "g/dL", rangeText: "12 - 15.5", rangeLow: 12, rangeHigh: 15.5, flag: "in_range", whatItMeasures: null },
    ]);
    expect(q).toContain("HbA1c is above");
    expect(q).not.toContain("Haemoglobin");
    expect(q).toContain("Rohan");
  });
});
