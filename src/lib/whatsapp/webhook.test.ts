import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { parseWebhook, verifySignature } from "./webhook";

const payload = (messages: unknown[]) => ({
  object: "whatsapp_business_account",
  entry: [
    {
      changes: [
        {
          value: {
            contacts: [{ wa_id: "919876543210", profile: { name: "Amma" } }],
            messages,
          },
        },
      ],
    },
  ],
});

describe("webhook", () => {
  it("accepts a correct signature and rejects a wrong one", () => {
    const body = JSON.stringify({ a: 1 });
    const sig = "sha256=" + createHmac("sha256", "secret").update(body).digest("hex");
    expect(verifySignature(body, sig, "secret")).toBe(true);
    expect(verifySignature(body, sig, "other")).toBe(false);
    expect(verifySignature(body, null, "secret")).toBe(false);
  });

  it("parses text, image, button and unknown messages", () => {
    const parsed = parseWebhook(
      payload([
        { from: "919876543210", id: "m1", type: "text", text: { body: "Hi CN-4821" } },
        { from: "919876543210", id: "m2", type: "image", image: { id: "media1", mime_type: "image/jpeg" } },
        { from: "919876543210", id: "m3", type: "interactive", interactive: { type: "button_reply", button_reply: { id: "taken:2026-10-21:l", title: "Taken" } } },
        { from: "919876543210", id: "m4", type: "sticker" },
      ]),
    );
    expect(parsed.map((p) => p.kind)).toEqual(["text", "media", "button", "other"]);
    expect(parsed[0]).toMatchObject({ text: "Hi CN-4821", name: "Amma" });
    expect(parsed[1]).toMatchObject({ mediaId: "media1" });
    expect(parsed[2]).toMatchObject({ buttonId: "taken:2026-10-21:l" });
  });

  it("ignores delivery status updates", () => {
    expect(parseWebhook({ entry: [{ changes: [{ value: { statuses: [{ id: "x" }] } }] }] })).toEqual([]);
  });
});
