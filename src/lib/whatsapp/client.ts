/**
 * Thin wrapper over the WhatsApp Cloud API. Server only: the token never
 * reaches the browser.
 */
const GRAPH = `https://graph.facebook.com/${process.env.WHATSAPP_GRAPH_VERSION ?? "v25.0"}`;

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}`);
  return v;
}

export class WhatsAppError extends Error {
  constructor(
    message: string,
    public code: number | null,
  ) {
    super(message);
  }
}

/** Meta's code for "outside the 24-hour window, use a template". */
export const OUTSIDE_WINDOW = 131047;

async function post(payload: Record<string, unknown>): Promise<string | null> {
  const res = await fetch(`${GRAPH}/${env("WHATSAPP_PHONE_NUMBER_ID")}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env("WHATSAPP_TOKEN")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
  });
  const json = (await res.json()) as { messages?: { id: string }[]; error?: { message: string; code: number } };
  if (!res.ok || json.error) throw new WhatsAppError(json.error?.message ?? `HTTP ${res.status}`, json.error?.code ?? null);
  return json.messages?.[0]?.id ?? null;
}

export function sendText(to: string, body: string) {
  return post({ to, type: "text", text: { body, preview_url: false } });
}

export type Button = { id: string; title: string };

/** Up to 3 reply buttons. Titles are cut to WhatsApp's 20-character limit. */
export function sendButtons(to: string, body: string, buttons: Button[]) {
  return post({
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: body },
      action: {
        buttons: buttons.slice(0, 3).map((b) => ({ type: "reply", reply: { id: b.id, title: b.title.slice(0, 20) } })),
      },
    },
  });
}

/** Pre-approved template, for messages we start outside the 24-hour window. */
export function sendTemplate(to: string, name: string, languageCode: string, bodyParams: string[]) {
  return post({
    to,
    type: "template",
    template: {
      name,
      language: { code: languageCode },
      components: bodyParams.length
        ? [{ type: "body", parameters: bodyParams.map((text) => ({ type: "text", text })) }]
        : [],
    },
  });
}

/** Downloads a photo or PDF the user sent. */
export async function downloadMedia(mediaId: string): Promise<{ bytes: ArrayBuffer; mimeType: string }> {
  const auth = { Authorization: `Bearer ${env("WHATSAPP_TOKEN")}` };
  const meta = (await (await fetch(`${GRAPH}/${mediaId}`, { headers: auth })).json()) as { url?: string; mime_type?: string };
  if (!meta.url) throw new WhatsAppError("Media URL not found", null);
  const file = await fetch(meta.url, { headers: auth });
  if (!file.ok) throw new WhatsAppError(`Media download failed: HTTP ${file.status}`, null);
  return { bytes: await file.arrayBuffer(), mimeType: meta.mime_type ?? file.headers.get("content-type") ?? "image/jpeg" };
}
