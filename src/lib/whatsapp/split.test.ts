import { describe, expect, it } from "vitest";
import { TEXT_MAX, splitMessage } from "./split";

describe("long WhatsApp texts", () => {
  it("leaves a short text as one message", () => {
    expect(splitMessage("Hello")).toEqual(["Hello"]);
  });

  it("cuts between paragraphs, each part within the limit, nothing lost", () => {
    const paras = Array.from({ length: 12 }, (_, i) => `${i}: ${"x".repeat(500)}`);
    const text = paras.join("\n\n");
    const parts = splitMessage(text);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.every((p) => p.length <= TEXT_MAX)).toBe(true);
    expect(parts.join("\n\n")).toBe(text);
  });

  it("cuts a long paragraph between lines, and one huge line mid-line", () => {
    const lines = Array.from({ length: 10 }, () => "• ".padEnd(600, "y")).join("\n");
    expect(splitMessage(lines, 1000).every((p) => p.length <= 1000)).toBe(true);
    const huge = "z".repeat(2500);
    expect(splitMessage(huge, 1000)).toEqual(["z".repeat(1000), "z".repeat(1000), "z".repeat(500)]);
  });
});
