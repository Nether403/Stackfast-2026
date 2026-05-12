# WebAILyzer — Deferred (Post-MVP)

## Status
**Deferred** — 2026-05-11

WebAILyzer was a public URL technology-detection worker (Go) that could be
used for enrichment of tool metadata. It was deferred to post-MVP in the
Phase 0 cleanup because:

1. It introduces SSRF risk if exposed as a public endpoint.
2. Enrichment is not on the MVP critical path — the static registry
   (`packages/registry`) is curated by hand for v1.
3. It's a separate Go service with its own deployment story — out of scope
   for the Node/TS monorepo MVP.

## Where the code lives

WebAILyzer was attached to this repository as a **git submodule gitlink** at
the path `WebAILyzerAPI/`, but no `.gitmodules` file was ever committed, so
the submodule was effectively orphaned — git knew the commit SHA but not
the remote URL.

| Detail | Value |
|---|---|
| Submodule path | `WebAILyzerAPI/` |
| Original commit SHA | `c4b2b84db86ad4e528ba27fe476f39754f4513d6` |
| Removed from index | 2026-05-11 (this commit) |
| Preserved on | `origin/archive/pre-rebuild` — pointer is intact there |

To recover the exact submodule pointer post-MVP:

```sh
git show origin/archive/pre-rebuild:WebAILyzerAPI
# → Subproject commit c4b2b84db86ad4e528ba27fe476f39754f4513d6
```

Once the decision is made to revive it, add it back properly with a real
remote and a `.gitmodules` entry:

```sh
git submodule add <remote-url> workers/webailyzer
git -C workers/webailyzer checkout c4b2b84db86ad4e528ba27fe476f39754f4513d6
```

(Note: the target path in the revived location is `workers/webailyzer/`,
matching the structure recorded in `SALVAGE_MANIFEST.md`.)

## Pre-integration checklist

Before reviving this worker for production, confirm:

- [ ] SSRF hardening: strict URL allowlist + DNS rebinding protection
- [ ] Runs in an isolated network namespace (no access to Neon, admin API, etc.)
- [ ] Timeout and memory caps on every scrape
- [ ] Output validated against a Zod schema before being accepted as
      enrichment input
- [ ] Audit log of every URL scraped + who initiated the scrape
- [ ] Deployed as an internal-only service — never publicly addressable
