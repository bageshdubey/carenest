import { after } from "next/server";
import { handleIncoming } from "@/lib/bot/handle";
import { parseWebhook, verifySignature } from "@/lib/whatsapp/webhook";

// Reading a prescription photo can take a while; Meta only needs a quick 200.
export const maxDuration = 300;

/** Meta calls this once when we register the webhook, to check the verify token. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

/** Every message the parent sends arrives here. */
export async function POST(request: Request) {
  const raw = await request.text();
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !verifySignature(raw, request.headers.get("x-hub-signature-256"), secret)) {
    return new Response("Invalid signature", { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  const messages = parseWebhook(body);
  // Reply to Meta first, then do the slow work.
  after(async () => {
    for (const msg of messages) {
      try {
        await handleIncoming(msg);
      } catch (e) {
        console.error("Failed to handle WhatsApp message", msg.id, e);
      }
    }
  });
  return new Response("OK", { status: 200 });
}
