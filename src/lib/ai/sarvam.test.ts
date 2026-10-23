import { describe, expect, it } from "vitest";
import { CHUNK_MAX, chunkText, joinWavs } from "./sarvam";

/** A tiny 16-bit mono WAV holding the given samples. */
function wav(samples: number[], rate = 24000): Buffer {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => data.writeInt16LE(s, i * 2));
  const fmt = Buffer.alloc(16);
  fmt.writeUInt16LE(1, 0);
  fmt.writeUInt16LE(1, 2);
  fmt.writeUInt32LE(rate, 4);
  fmt.writeUInt32LE(rate * 2, 8);
  fmt.writeUInt16LE(2, 12);
  fmt.writeUInt16LE(16, 14);
  const head = Buffer.alloc(12);
  head.write("RIFF", 0, "ascii");
  head.writeUInt32LE(4 + 24 + 8 + data.length, 4);
  head.write("WAVE", 8, "ascii");
  const chunk = (id: string, body: Buffer) => {
    const h = Buffer.alloc(8);
    h.write(id, 0, "ascii");
    h.writeUInt32LE(body.length, 4);
    return Buffer.concat([h, body]);
  };
  return Buffer.concat([head, chunk("fmt ", fmt), chunk("data", data)]);
}

describe("sarvam chunks", () => {
  it("keeps short text in one piece", () => {
    expect(chunkText("Lunch time, Amma.")).toEqual(["Lunch time, Amma."]);
  });

  it("splits long text under the limit, at paragraph breaks first", () => {
    const para = "एम्लोडिपिन 5 mg, 1 गोली, खाने के बाद। ".repeat(40).trim();
    const chunks = chunkText([para, para, para].join("\n\n"));
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(CHUNK_MAX);
    expect(chunks.join(" ").replace(/\s+/g, " ")).toBe([para, para, para].join(" ").replace(/\s+/g, " "));
  });
});

describe("joining WAV files", () => {
  it("joins the samples into one valid WAV", () => {
    const joined = joinWavs([wav([1, 2]), wav([3, 4, 5])]);
    expect(joined.equals(wav([1, 2, 3, 4, 5]))).toBe(true);
  });

  it("refuses parts with different formats", () => {
    expect(() => joinWavs([wav([1], 24000), wav([2], 22050)])).toThrow();
  });
});
