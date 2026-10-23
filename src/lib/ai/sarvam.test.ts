import { afterEach, describe, expect, it, vi } from "vitest";
import { VOICE_MAX_CHARS, speak } from "./sarvam";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("sarvam voice", () => {
  it("skips text too long for a WhatsApp voice note, without calling Sarvam", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    vi.stubEnv("SARVAM_API_KEY", "test-key");
    expect(await speak("a".repeat(VOICE_MAX_CHARS + 1), "en")).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("asks for the parent's language and that language's voice", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ audios: [Buffer.from("RIFF").toString("base64")] })));
    vi.stubGlobal("fetch", fetch);
    vi.stubEnv("SARVAM_API_KEY", "test-key");
    const result = await speak("दोपहर के खाने का समय, अम्मा।", "hi");
    expect(result?.mimeType).toBe("audio/wav");
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.language_code).toBe("hi-IN");
    expect(body.speaker).toMatch(/_hi_/);
    expect(body.text).toBe("दोपहर के खाने का समय, अम्मा।");
  });
});
