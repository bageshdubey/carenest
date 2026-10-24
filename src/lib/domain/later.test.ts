import { describe, expect, it } from "vitest";
import { pm } from "@/lib/i18n/parent";
import { doseStep, istClock, type OpenDose } from "./meals";

// India time on 25 Oct 2026; a lunch reminder went at 1:30 pm (08:00 UTC).
const at = (ist: string) => new Date(`2026-10-25T${ist}:00+05:30`);
const sent = at("13:30").toISOString();
const dose = (extra: Partial<OpenDose> = {}): OpenDose => ({ sent_at: sent, reminded_at: null, later_until: null, followup_at: null, ...extra });

describe("open reminder steps", () => {
  it("waits, then follows up once at 30 minutes, then not marked at 60", () => {
    expect(doseStep(dose(), at("13:59"))).toBe("wait");
    expect(doseStep(dose(), at("14:00"))).toBe("followup");
    expect(doseStep(dose({ followup_at: at("14:00").toISOString() }), at("14:20"))).toBe("wait");
    expect(doseStep(dose({ followup_at: at("14:00").toISOString() }), at("14:30"))).toBe("missed");
  });

  it("waits while Later is pending, even past the hour, then sends again", () => {
    const later = dose({ later_until: at("14:00").toISOString() });
    expect(doseStep(later, at("13:45"))).toBe("wait");
    expect(doseStep(later, at("14:00"))).toBe("resend");
    expect(doseStep(dose({ later_until: at("15:00").toISOString() }), at("14:45"))).toBe("wait");
  });

  it("counts the hour from the last reminder after Later", () => {
    const resent = dose({ reminded_at: at("14:00").toISOString() });
    expect(doseStep(resent, at("14:29"))).toBe("wait");
    expect(doseStep(resent, at("14:30"))).toBe("followup");
    expect(doseStep(resent, at("14:59"))).toBe("followup");
    expect(doseStep(resent, at("15:00"))).toBe("missed");
  });

  it("goes straight to not marked when the follow-up time was missed by downtime", () => {
    expect(doseStep(dose(), at("15:10"))).toBe("missed");
  });
});

describe("Later texts", () => {
  it("names the time in India time", () => {
    expect(istClock(at("14:05"))).toBe("2:05 pm");
    expect(pm("en", "laterOk", { n: "Papa", t: istClock(at("14:05")) })).toBe("OK, Papa. I'll remind you again at 2:05 pm.");
  });

  it("keeps button labels within WhatsApp's 20 characters", () => {
    for (const lang of ["en", "hi", "mr"] as const) {
      expect(pm(lang, "q_later").length).toBeLessThanOrEqual(20);
    }
  });
});
