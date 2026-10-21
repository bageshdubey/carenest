import "server-only";
import { spawn } from "node:child_process";
import ffmpeg from "@ffmpeg-installer/ffmpeg";

/** WhatsApp shows a play button only for OGG/Opus voice notes up to 512 KB. */
export const VOICE_NOTE_MAX_BYTES = 512 * 1024;

/**
 * Converts Gemini's speech (WAV, or raw 16-bit PCM like "audio/L16;rate=24000") into a
 * mono OGG/Opus voice note. 24 kbit/s keeps about 2.5 minutes under WhatsApp's limit.
 */
export function toVoiceNote(audio: Buffer, mimeType: string): Promise<Buffer> {
  const rawPcm = /l16|pcm/i.test(mimeType);
  const rate = /rate=(\d+)/i.exec(mimeType)?.[1] ?? "24000";
  const input = rawPcm ? ["-f", "s16le", "-ar", rate, "-ac", "1"] : [];
  const args = ["-hide_banner", "-loglevel", "error", ...input, "-i", "pipe:0", "-ac", "1", "-ar", "48000", "-c:a", "libopus", "-b:a", "24k", "-application", "voip", "-f", "ogg", "pipe:1"];
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpeg.path, args);
    const out: Buffer[] = [];
    let err = "";
    proc.stdout.on("data", (d: Buffer) => out.push(d));
    proc.stderr.on("data", (d: Buffer) => (err += d.toString()));
    proc.on("error", reject);
    proc.on("close", (code) => (code === 0 ? resolve(Buffer.concat(out)) : reject(new Error(`ffmpeg exited with ${code}: ${err.slice(0, 300)}`))));
    proc.stdin.on("error", reject);
    proc.stdin.end(audio);
  });
}
