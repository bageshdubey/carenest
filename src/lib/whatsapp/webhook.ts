import { createHmac, timingSafeEqual } from "node:crypto";

/** Checks Meta's X-Hub-Signature-256 header against the raw request body. */
export function verifySignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const given = header.slice("sha256=".length);
  if (given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given, "hex"), Buffer.from(expected, "hex"));
}

export type Incoming =
  | { kind: "text"; from: string; id: string; name: string | null; text: string }
  | { kind: "media"; from: string; id: string; name: string | null; mediaId: string; mimeType: string; caption: string | null }
  | { kind: "button"; from: string; id: string; name: string | null; buttonId: string; title: string }
  | { kind: "other"; from: string; id: string; name: string | null; type: string };

type WaMessage = {
  from: string;
  id: string;
  type: string;
  text?: { body: string };
  image?: { id: string; mime_type: string; caption?: string };
  document?: { id: string; mime_type: string; caption?: string };
  interactive?: { type: string; button_reply?: { id: string; title: string } };
  button?: { payload: string; text: string };
};

/** Pulls the messages out of a WhatsApp webhook payload. Delivery statuses are ignored. */
export function parseWebhook(body: unknown): Incoming[] {
  const out: Incoming[] = [];
  const entries = (body as { entry?: unknown[] })?.entry ?? [];
  for (const entry of entries as { changes?: unknown[] }[]) {
    for (const change of (entry.changes ?? []) as { value?: Record<string, unknown> }[]) {
      const value = change.value ?? {};
      const contacts = (value.contacts as { wa_id: string; profile?: { name?: string } }[]) ?? [];
      for (const m of ((value.messages as WaMessage[]) ?? [])) {
        const name = contacts.find((c) => c.wa_id === m.from)?.profile?.name ?? null;
        const base = { from: m.from, id: m.id, name };
        if (m.type === "text" && m.text) {
          out.push({ ...base, kind: "text", text: m.text.body });
        } else if ((m.type === "image" || m.type === "document") && (m.image ?? m.document)) {
          const media = (m.image ?? m.document)!;
          out.push({ ...base, kind: "media", mediaId: media.id, mimeType: media.mime_type, caption: media.caption ?? null });
        } else if (m.type === "interactive" && m.interactive?.button_reply) {
          out.push({ ...base, kind: "button", buttonId: m.interactive.button_reply.id, title: m.interactive.button_reply.title });
        } else if (m.type === "button" && m.button) {
          out.push({ ...base, kind: "button", buttonId: m.button.payload, title: m.button.text });
        } else {
          out.push({ ...base, kind: "other", type: m.type });
        }
      }
    }
  }
  return out;
}
