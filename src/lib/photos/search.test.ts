import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { pickSample } = await import("./search");

describe("pickSample", () => {
  it("takes the first https photo and credits its site without www", () => {
    expect(
      pickSample([
        { imageUrl: "http://old.example/a.jpg", domain: "old.example" },
        { imageUrl: "https://images.apollo247.in/t.jpg", domain: "www.apollopharmacy.in" },
      ]),
    ).toEqual({ url: "https://images.apollo247.in/t.jpg", source: "apollopharmacy.in" });
  });

  it("falls back to the page's host when the site is missing", () => {
    expect(pickSample([{ imageUrl: "https://cdn.x.in/a.jpg", link: "https://www.pharmeasy.in/p/1" }])).toEqual({
      url: "https://cdn.x.in/a.jpg",
      source: "pharmeasy.in",
    });
  });

  it("is null with no usable result", () => {
    expect(pickSample([])).toBeNull();
    expect(pickSample([{ domain: "a.in" }])).toBeNull();
  });
});
