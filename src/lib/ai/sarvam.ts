import type { ParentLang } from "@/lib/domain/types";

/**
 * Voice notes for the parent, spoken by Sarvam's Bulbul in an Indian voice for each language.
 * Sarvam only reads the text it is given (no prompt), so nothing but the reply is spoken.
 * Voices on bulbul:v4-flash belong to one language, so each parent language has its own.
 */
const API_URL = "https://api.sarvam.ai/text-to-speech";
const MODEL = process.env.SARVAM_MODEL || "bulbul:v4-flash";
const PACE = Number(process.env.SARVAM_PACE || "1.0");
const LANGUAGE_CODE: Record<ParentLang, string> = { en: "en-IN", hi: "hi-IN", mr: "mr-IN" };
const SPEAKER: Record<ParentLang, string> = {
  en: process.env.SARVAM_SPEAKER_EN || "roopa_en_conversational",
  hi: process.env.SARVAM_SPEAKER_HI || "roopa_hi_conversational",
  mr: process.env.SARVAM_SPEAKER_MR || "ishita_mr_conversational",
};

/**
 * WhatsApp plays voice notes up to 512 KB, about 1,500 characters of speech at our bitrate
 * (tested 23 Oct 2026). Longer replies, such as big reports, go as text only, so no credits are spent on audio WhatsApp would refuse.
 * This is also under Sarvam's 2,500-character limit, so one request is enough.
 */
export const VOICE_MAX_CHARS = 1500;
/** A voice note that takes longer is skipped and the text still goes. */
const TIMEOUT_MS = 30_000;

/** Reads a reply aloud in the parent's language. Returns WAV audio, or null if the text is too long or there is no Sarvam key. */
export async function speak(text: string, lang: ParentLang): Promise<{ data: Buffer; mimeType: string } | null> {
  if (text.length > VOICE_MAX_CHARS) return null;
  const apiKey = process.env.SARVAM_API_KEY;
  if (!apiKey) {
    console.error("SARVAM_API_KEY is not set, so no voice note");
    return null;
  }
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "api-subscription-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ text, language_code: LANGUAGE_CODE[lang], speaker: SPEAKER[lang], model: MODEL, pace: PACE, output_audio_codec: "wav" }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Sarvam ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const audio = ((await res.json()) as { audios?: string[] }).audios?.[0];
  if (!audio) throw new Error("Sarvam returned no audio");
  return { data: Buffer.from(audio, "base64"), mimeType: "audio/wav" };
}
