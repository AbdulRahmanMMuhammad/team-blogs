import { describe, expect, it } from "vitest";
import { parseLabels, postState, referrerHost, slugify, SLUG_PATTERN } from "./text";

describe("slugify", () => {
  it("makes a valid address from a title", () => {
    expect(slugify("Day one: Maple Pass!")).toBe("day-one-maple-pass");
    expect(slugify("Crème brûlée")).toBe("creme-brulee");
    expect(SLUG_PATTERN.test(slugify("  Hello -- World  "))).toBe(true);
  });
});

describe("parseLabels", () => {
  it("trims and drops blanks and repeats", () => {
    expect(parseLabels(" travel, Gear ,, travel,gear ")).toEqual(["travel", "Gear"]);
  });
});

describe("postState", () => {
  it("tells scheduled from published by date", () => {
    expect(postState("draft", null, 10)).toBe("draft");
    expect(postState("published", 20, 10)).toBe("scheduled");
    expect(postState("published", 5, 10)).toBe("published");
  });
});

describe("referrerHost", () => {
  it("keeps other sites only", () => {
    expect(referrerHost("https://news.example.org/a", "app.test")).toBe("news.example.org");
    expect(referrerHost("http://app.test/b/x", "app.test")).toBeNull();
    expect(referrerHost("not a url", "app.test")).toBeNull();
  });
});
