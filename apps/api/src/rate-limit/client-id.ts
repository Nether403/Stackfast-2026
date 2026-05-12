/**
 * Client-id resolution for the rate limiter (R4.4).
 *
 * Header precedence:
 *   1. `x-forwarded-for` — when present, use the left-most IP (comma-split,
 *      trimmed). Proxies append the chain right-ward, so the first entry is
 *      the originating client.
 *   2. `cf-connecting-ip` — Cloudflare's single-IP header; used verbatim.
 *   3. the literal string `"local"` — fallback when no client-id header is
 *      present (covers loopback requests and local dev).
 *
 * Pure function. No side effects, no Hono import — takes whatever header bag
 * the caller wants to pass in. Callers can pass either Hono's `c.req` header
 * accessor result, a `Headers` instance, or a plain record.
 */

export type HeaderLookup =
  | Headers
  | Record<string, string | string[] | undefined>
  | ((name: string) => string | null | undefined);

const XFF_HEADER = "x-forwarded-for";
const CF_HEADER = "cf-connecting-ip";
const FALLBACK = "local";

export function resolveClientId(headers: HeaderLookup): string {
  const xff = readHeader(headers, XFF_HEADER);
  if (xff) {
    const leftMost = xff.split(",")[0]?.trim();
    if (leftMost) {
      return leftMost;
    }
  }

  const cf = readHeader(headers, CF_HEADER);
  if (cf) {
    const trimmed = cf.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return FALLBACK;
}

function readHeader(headers: HeaderLookup, name: string): string | undefined {
  if (typeof headers === "function") {
    const value = headers(name);
    return typeof value === "string" ? value : undefined;
  }

  if (headers instanceof Headers) {
    const value = headers.get(name);
    return value ?? undefined;
  }

  // Plain record — match the key case-insensitively, as HTTP headers allow.
  const record = headers as Record<string, string | string[] | undefined>;
  const target = name.toLowerCase();
  for (const key of Object.keys(record)) {
    if (key.toLowerCase() === target) {
      const value = record[key];
      if (Array.isArray(value)) {
        return value[0];
      }
      return value;
    }
  }
  return undefined;
}
