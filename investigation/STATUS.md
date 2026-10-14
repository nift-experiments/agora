# Agora final implementation checkpoint — agora

Global source-model implementation and independent clean-clone corpus certification are complete. This is an engineering checkpoint, not a Labs publication or an unqualified production deployment claim.

- Pinned upstream: `3c6552914e6cec74ab5d9c38b3bd4eeb51871d13`.
- Both source models preserve 1,657 article identities, the complete 2,017 reference HTML paths (including fallback/alias/verification paths), and all 3,100 non-HTML non-bundle reference paths.
- Canonical document payload fields, Markdown bytes and LLM block content match the frozen reference. Search row and LLM block order vary in upstream; those differences are reported explicitly.
- All 1,657 compiled article modules match across models. Source models intentionally differ; application JavaScript and content-addressed bundle layout are not upstream byte identities.
- Independent GitHub clones reproduced the global publication. Warm/restored output retains exact non-HTML bytes and exact HTML after comparison-only normalization of TanStack Router bootstrap timestamps. Production timestamps are untouched.
- Root normal build and `nift status` pass. TypeScript checks pass. Authored incremental/full projection equivalence passes. Representative hydration, search/navigation/history, API controls, code tabs, FAQ filtering, theme controls and narrow-screen drawer behavior were exercised.
- Full upstream-derived unit suite is not green: inherited source/dependency/environment failures remain recorded in external certification evidence. No source content was altered merely to satisfy stale assertions.
- Retained TanStack Start/Router, React, hydration and client navigation remain meaningful parts of the application. Nift composes prepared raw HTML with explicit dependencies; this is not native `@markup` performance.

## Focused prior-experiment review

Reviewed local Capgo/Docker implementation and Deno/SpaceX report sources, plus SpaceX's public maintained-asset acquisition code. Reused content fingerprints, lazy expensive initialization, bounded workers, stable cached projections and separation of maintained assets from routine generation. Both payload updaters now defer their worker/source graph import until a dirty module or full fallback requires it. Do not adopt another project's static runtime model without proving TanStack parity.

## Remaining qualifications and recommendation

**NEEDS FURTHER WORK before public promotion.** Complete CN production publication requires its explicit intended origin/configuration and separate regional certification. Hosting rules are retained but an actual deployment build image must provide Nift; the local Python preview does not emulate redirects or content negotiation. Private Algolia indexing and live service/API writes were not performed. CDN assets remain original external references. See KNOWN-DIVERGENCES.md.

The small serialized campaign is preserved privately, including superseded incomplete-scope observations and the corrected capture. No additional upstream builds or prior-experiment benchmarks were run. No Nift core, Labs or previous migration source was modified. No announcement or maintainer contact is authorized.

Root commands: `bun run install:app`, `bun run build`, `bun run build:full`, `bun run serve`. Root `public/` is the publication. Follow README/HANDOVER and preserve the explicit editorial-date workflow.
