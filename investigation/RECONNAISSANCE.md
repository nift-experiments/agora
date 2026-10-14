# Agora reconnaissance — Checkpoint 2

Pinned upstream: 3c6552914e6cec74ab5d9c38b3bd4eeb51871d13. Full Git history, separate immutable source/reference and disposable build checkout. No migration implementation yet.

## Verified scope

2,752 tracked files, 3,229 recursive tree entries including directories. 1,657 Markdown/MDX sources: 937 en / 720 zh-CN. 17 OpenAPI JSON/YAML specifications; the content/openapi folder also contains non-specification material. 324 navigation metadata JSON files and 13 includes. Source counts are not publication counts.

Default and production CI publish global/en. Chinese requires a separate cn region plus explicit SITE_URL; the source does not declare its new production canonical origin. The shengwang.cn legacy target is not evidence of that new origin. Preserve the supported regional split, do not silently unify both languages in the measured global build. A source-based CN proof can be separately qualified until its production origin is established.

## Complete local publication

Redirect check → OpenAPI sync → full-history Git last-updated manifest → static docs payload generation → TanStack Start/Vite client+server compilation and prerender → static route HTML postprocessing. Both static payload and route HTML generators invoke Vite themselves. Deployed static root is dist/client; preserve hosting redirect/header/content-negotiation artifacts, not HTML only.

The baseline-supported Node is 22.22.1 (>=22.12), Bun 1.4.3, with frozen bun.lock. CI uses Node 24 and moving Bun latest; the local toolchain difference is disclosed. Dependencies resolve React 19.2.8, Router 1.170.18, Start 1.168.32, Vite 8.1.5, Fumadocs core/UI 16.13.0, MDX 15.2.0, OpenAPI 11.2.2. A patch for @fumadocs/api-docs 0.2.1 is included upstream.

Full-history build regenerated a tracked docs-last-updated artifact with ten changed entries; this is normal build output, not a manual source modification. Immutable upstream source stays clean. Freeze the built artifact and source history completeness as part of reference provenance.

## Meaningful TanStack/Fumadocs ownership

Router preloads/transitions/scroll restoration and React shell/sidebar/version/platform selection must remain meaningful. Preserve code tabs/copy, platform preferences, hash-aware accordions/headings, image zoom/dialogs, calculators, search and rich OpenAPI schema/response/examples. Upstream OpenAPI authenticated playground is disabled, so do not implement absent behavior.

Important seam: public/__static page/search/route/SEO payloads, Markdown/LLM projections and sitemap. Important qualification: body payloads are MDX descriptors, not rendered HTML. source.browser.tsx lazily imports compiled collections/browser modules. Merely putting Nift around the current generators does not isolate content or avoid corpus compilation.

Recommended proof after baseline: authoritative Fumadocs/React content compilation+rendering separated from reusable Start/Router UI assets, with explicit per-document/includes/navigation/component/OpenAPI dependencies. Nift owns suitable publication composition/metadata/routes while Start/Router remains the application runtime. Establish matched hydration and client-navigation article ownership first; no broad migration or static snapshot benchmark. Changes to genuine article components may require content rerendering; unrelated frontend edits must not invalidate every document gratuitously.

## External input boundaries

Global canonical source default is https://docs.agora.io. CI sets global region, ranking-v2 flag and deployment/version metadata, pulls private Vercel environment, and configures public-client Algolia plus analytics. Production Algolia federates portal and SDK-symbol indexes; index state is external. Supported no-credential local fallback is Orama, not proof of production configured-search parity. Admin search:sync/replay is workflow-only, not package build. Do not write remote indexes or request admin credentials.

English images include external Agora asset-CDN references; freeze unique URLs/metadata/required bytes separately. Seven referenced OG images are maintained CDN assets. og:generate is explicit maintenance, not part of routine build, and must not be inserted artificially into Nift timings. No administrative S3 asset upload, feedback submission or analytics event is required by local parity capture.

## Measurement method

20 ms requested sampling sleep plus /proc/trace overhead; retain observed sample spacing. Sum simultaneously observed workload process-group/descendant RSS, excluding observer and GNU-time wrapper. Shared pages can count multiple times; short-lived peaks can be missed. Also retain GNU-time maximum individual-process RSS. Approximate phase labels come from recorded command-log events. Independent read-only review found no blocking sampler defect; a parent+allocated child proof verified child inclusion. Do not confuse unchanged inputs with an upstream no-op: original publication runs every stage.

The first untouched-source full build is diagnostic, not a final median. No performance result has been published externally. Baseline evidence stays local; Labs/public announcements await explicit approval. Major implementation follows verified baseline assessment.
