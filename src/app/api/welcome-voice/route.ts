import { speak } from "@/lib/ai/sarvam";
import type { ParentLang } from "@/lib/domain/types";
import { pm } from "@/lib/i18n/parent";
import { currentSession } from "@/lib/supabase/server";

export const maxDuration = 60;

const LANGS: ParentLang[] = ["en", "hi", "mr"];
/** Names are short; the cap stops this route being used to read out long text on our Sarvam credits. */
const NAME_MAX = 40;

/**
 * The setup wizard's preview: the parent's welcome message, spoken by the same Sarvam voice
 * the parent will hear on WhatsApp. Only signed-in users, and only the fixed welcome text.
 */
export async function GET(request: Request) {
  const { user } = await currentSession();
  if (!user) return new Response("Sign in first", { status: 401 });

  const params = new URL(request.url).searchParams;
  const lang = params.get("lang") as ParentLang;
  const callName = (params.get("n") ?? "").trim().slice(0, NAME_MAX);
  const childName = (params.get("c") ?? "").trim().slice(0, NAME_MAX);
  if (!LANGS.includes(lang) || !callName || !childName) return new Response("Bad request", { status: 400 });

  try {
    const speech = await speak(pm(lang, "welcome", { n: callName, c: childName }), lang);
    if (!speech) return new Response("No voice available", { status: 503 });
    return new Response(new Uint8Array(speech.data), {
      headers: { "Content-Type": speech.mimeType, "Cache-Control": "private, max-age=3600" },
    });
  } catch (e) {
    console.error("Welcome voice preview failed", e);
    return new Response("Voice failed", { status: 502 });
  }
}
