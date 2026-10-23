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

/** Sarvam reads at most 2,500 characters per request. */
export const CHUNK_MAX = 2500;
/** Per request. A voice note that takes longer is skipped and the text still goes. */
const TIMEOUT_MS = 30_000;

/** Splits text into pieces Sarvam accepts, at paragraph breaks, then line breaks, then spaces. */
export function chunkText(text: string, max = CHUNK_MAX): string[] {
  const chunks: string[] = [];
  let rest = text.trim();
  while (rest.length > max) {
    const window = rest.slice(0, max + 1);
    const cut = [window.lastIndexOf("\n\n"), window.lastIndexOf("\n"), window.lastIndexOf(" ")].find((i) => i > 0) ?? max;
    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

/** Reads the format and the sample data out of a WAV file. */
function wavParts(wav: Buffer): { fmt: Buffer; data: Buffer } {
  if (wav.toString("ascii", 0, 4) !== "RIFF" || wav.toString("ascii", 8, 12) !== "WAVE") throw new Error("Not a WAV file");
  let fmt: Buffer | null = null;
  let offset = 12;
  while (offset + 8 <= wav.length) {
    const id = wav.toString("ascii", offset, offset + 4);
    const size = wav.readUInt32LE(offset + 4);
    const body = wav.subarray(offset + 8, Math.min(offset + 8 + size, wav.length));
    if (id === "fmt ") fmt = body;
    if (id === "data") {
      if (!fmt) throw new Error("WAV data before format");
      return { fmt, data: body };
    }
    offset += 8 + size + (size % 2);
  }
  throw new Error("WAV has no data");
}

/** Joins WAV files of the same format into one, so a long reply is still one voice note. */
export function joinWavs(wavs: Buffer[]): Buffer {
  if (wavs.length === 1) return wavs[0];
  const parts = wavs.map(wavParts);
  const fmt = parts[0].fmt;
  if (parts.some((p) => !p.fmt.equals(fmt))) throw new Error("WAV parts differ in format");
  const data = Buffer.concat(parts.map((p) => p.data));
  const head = Buffer.alloc(12);
  head.write("RIFF", 0, "ascii");
  head.writeUInt32LE(4 + 8 + fmt.length + 8 + data.length, 4);
  head.write("WAVE", 8, "ascii");
  const chunk = (id: string, body: Buffer) => {
    const h = Buffer.alloc(8);
    h.write(id, 0, "ascii");
    h.writeUInt32LE(body.length, 4);
    return Buffer.concat([h, body]);
  };
  return Buffer.concat([head, chunk("fmt ", fmt), chunk("data", data)]);
}

async function speakChunk(text: string, lang: ParentLang, apiKey: string): Promise<Buffer> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "api-subscription-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ text, language_code: LANGUAGE_CODE[lang], speaker: SPEAKER[lang], model: MODEL, pace: PACE, output_audio_codec: "wav" }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Sarvam ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const audio = ((await res.json()) as { audios?: string[] }).audios?.[0];
  if (!audio) throw new Error("Sarvam returned no audio");
  return Buffer.from(audio, "base64");
}

/** Reads a reply aloud in the parent's language. Returns WAV audio, or null if there is no Sarvam key. */
export async function speak(text: string, lang: ParentLang): Promise<{ data: Buffer; mimeType: string } | null> {
  const apiKey = process.env.SARVAM_API_KEY;
  if (!apiKey) {
    console.error("SARVAM_API_KEY is not set, so no voice note");
    return null;
  }
  const wavs: Buffer[] = [];
  for (const chunk of chunkText(text)) wavs.push(await speakChunk(chunk, lang, apiKey));
  if (!wavs.length) return null;
  return { data: joinWavs(wavs), mimeType: "audio/wav" };
}
