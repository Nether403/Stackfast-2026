import { describe, expect, it } from "vitest";
import { BUCKETS, BUCKET_NAMES, type BucketName } from "./buckets.js";

describe("rate-limit buckets", () => {
  it("configures the generation bucket at 30 requests per 60s (R4.2)", () => {
    expect(BUCKETS.generation).toEqual({ limit: 30, windowMs: 60_000 });
  });

  it("configures the read bucket at 100 requests per 60s (R4.3)", () => {
    expect(BUCKETS.read).toEqual({ limit: 100, windowMs: 60_000 });
  });

  it("exposes exactly the two bucket names used by the middleware", () => {
    expect(BUCKET_NAMES).toEqual(["generation", "read"]);
    const keys = Object.keys(BUCKETS) as BucketName[];
    expect(new Set(keys)).toEqual(new Set(["generation", "read"]));
  });

  it("uses a 60 second window for every bucket", () => {
    for (const name of BUCKET_NAMES) {
      expect(BUCKETS[name].windowMs).toBe(60_000);
    }
  });
});
