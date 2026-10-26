import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FamilyRow } from "@/lib/db/rows";

vi.mock("server-only", () => ({}));
const addAlert = vi.fn();
vi.mock("@/lib/db/repo", () => ({ addAlert, logMessage: vi.fn() }));
vi.mock("@/lib/ai/sarvam", () => ({ speak: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/audio", () => ({ VOICE_NOTE_MAX_BYTES: 512 * 1024, toVoiceNote: vi.fn() }));

const { alertChild, reminderToParent, toParent } = await import("./send");

const HOUR = 60 * 60 * 1000;
const family = (lastMessageHoursAgo: number): FamilyRow => ({
  id: "f1",
  owner_id: "u1",
  child_name: "Asha",
  child_lang: "en",
  parent_call_name: "Papa",
  parent_phone: "919800000000",
  parent_lang: "hi",
  meal_b: "08:30",
  meal_l: "13:30",
  meal_d: "20:30",
  link_code: "CN-1234",
  parent_linked_at: new Date().toISOString(),
  last_parent_message_at: new Date(Date.now() - lastMessageHoursAgo * HOUR).toISOString(),
  created_at: new Date().toISOString(),
});
const buttons = [
  { id: "taken:2026-10-26:d", title: "ले ली" },
  { id: "later:2026-10-26:d", title: "बाद में" },
  { id: "list", title: "मेरी सूची" },
];
const params = ["Papa", "रात का खाना", "Amlodipine 5 mg"];

let fetch: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetch = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ messages: [{ id: "wamid.1" }] })));
  vi.stubGlobal("fetch", fetch);
  vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "123");
  vi.stubEnv("WHATSAPP_TOKEN", "test-token");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("meal reminder outside the 24-hour window", () => {
  it("sends the template in the parent's language, with the Taken and Later codes on its buttons", async () => {
    vi.stubEnv("WHATSAPP_TEMPLATE_REMINDER", "carenest_meal_reminder");
    expect(await reminderToParent(family(30), "body", buttons, params)).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
    const { template } = JSON.parse(fetch.mock.calls[0][1].body);
    expect(template.name).toBe("carenest_meal_reminder");
    expect(template.language.code).toBe("hi");
    expect(template.components[0].parameters.map((p: { text: string }) => p.text)).toEqual(params);
    expect(template.components.slice(1)).toEqual([
      { type: "button", sub_type: "quick_reply", index: "0", parameters: [{ type: "payload", payload: "taken:2026-10-26:d" }] },
      { type: "button", sub_type: "quick_reply", index: "1", parameters: [{ type: "payload", payload: "later:2026-10-26:d" }] },
    ]);
  });

  it("sends nothing and says so when no template is set", async () => {
    vi.stubEnv("WHATSAPP_TEMPLATE_REMINDER", "");
    expect(await reminderToParent(family(30), "body", buttons, params)).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sends the normal reminder inside the window", async () => {
    vi.stubEnv("WHATSAPP_TEMPLATE_REMINDER", "carenest_meal_reminder");
    expect(await reminderToParent(family(2), "body", buttons, params)).toBe(true);
    expect(JSON.parse(fetch.mock.calls[0][1].body).type).toBe("interactive");
  });
});

describe("long messages to the parent", () => {
  it("sends a text over WhatsApp's 4,096 characters as several messages, each within the limit", async () => {
    const body = Array.from({ length: 10 }, (_, i) => `• Medicine ${i} ${"x".repeat(600)}`).join("\n\n");
    await toParent(family(30), body);
    const texts = fetch.mock.calls.map((c) => JSON.parse(c[1].body).text.body as string);
    expect(texts.length).toBeGreaterThan(1);
    expect(texts.every((t) => t.length <= 4096)).toBe(true);
    expect(texts.join("\n\n")).toBe(body);
  });
});

describe("alerts for the child", () => {
  it("keeps the parent's own words as they are, even with placeholders or $ signs", async () => {
    addAlert.mockClear();
    await alertChild(family(1), "advice_question", { q: "can I take {p} or $' tablets?" });
    expect(addAlert.mock.calls[0][3].text).toBe('CareNest: Papa asked "can I take {p} or $\' tablets?". They were told to ask the doctor or call you.');
  });
});
