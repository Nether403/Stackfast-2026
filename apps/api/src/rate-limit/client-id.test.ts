import { describe, expect, it } from "vitest";
import { resolveClientId } from "./client-id.js";

describe("resolveClientId (R4.4)", () => {
  it("prefers x-forwarded-for over cf-connecting-ip and local", () => {
    const id = resolveClientId({
      "x-forwarded-for": "203.0.113.7",
      "cf-connecting-ip": "198.51.100.9",
    });

    expect(id).toBe("203.0.113.7");
  });

  it("falls back to cf-connecting-ip when x-forwarded-for is absent", () => {
    const id = resolveClientId({ "cf-connecting-ip": "198.51.100.9" });

    expect(id).toBe("198.51.100.9");
  });

  it('falls back to "local" when neither header is present', () => {
    expect(resolveClientId({})).toBe("local");
  });

  it('falls back to "local" when both headers are empty strings', () => {
    const id = resolveClientId({
      "x-forwarded-for": "",
      "cf-connecting-ip": "",
    });

    expect(id).toBe("local");
  });

  it("takes the left-most IP when x-forwarded-for is a comma-separated chain", () => {
    const id = resolveClientId({
      "x-forwarded-for": "203.0.113.7, 198.51.100.9, 10.0.0.1",
    });

    expect(id).toBe("203.0.113.7");
  });

  it("trims whitespace around the left-most IP", () => {
    const id = resolveClientId({
      "x-forwarded-for": "   203.0.113.7  ,  198.51.100.9  ",
    });

    expect(id).toBe("203.0.113.7");
  });

  it("skips an empty left-most segment and falls through to cf-connecting-ip", () => {
    const id = resolveClientId({
      "x-forwarded-for": ", 198.51.100.9",
      "cf-connecting-ip": "cf-fallback",
    });

    expect(id).toBe("cf-fallback");
  });

  it("reads headers from a Headers instance", () => {
    const headers = new Headers();
    headers.set("x-forwarded-for", "203.0.113.42, 10.0.0.1");

    expect(resolveClientId(headers)).toBe("203.0.113.42");
  });

  it("reads headers through a getter function (Hono-style)", () => {
    const get = (name: string): string | null => {
      if (name === "x-forwarded-for") return null;
      if (name === "cf-connecting-ip") return "198.51.100.9";
      return null;
    };

    expect(resolveClientId(get)).toBe("198.51.100.9");
  });

  it("matches headers case-insensitively on plain records", () => {
    const id = resolveClientId({ "X-Forwarded-For": "203.0.113.7" });

    expect(id).toBe("203.0.113.7");
  });
});
