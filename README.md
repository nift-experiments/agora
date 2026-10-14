# Agora documentation: Nift + TanStack, authored source

This independent experiment preserves Agora's TanStack Start/Router, React and Fumadocs application while moving document compilation and dependency-aware publication into a Nift-assisted pipeline. The global implementation reproduces the complete reference route and non-bundle publication scope from clean GitHub clones. Regional deployment and external-service qualifications remain explicit below.

Upstream source is [AgoraIO/docs-portal](https://github.com/AgoraIO/docs-portal), pinned to `3c6552914e6cec74ab5d9c38b3bd4eeb51871d13`. Apache 2.0 attribution and licensing are retained. See [UPSTREAM.md](UPSTREAM.md), [MIGRATION.md](MIGRATION.md), [HANDOVER.md](HANDOVER.md) and [investigation/STATUS.md](investigation/STATUS.md).

## Build and serve

Prerequisites: Nift 4.12.0, Bun 1.4.3, Node compatible with upstream's `>=22.12.0` requirement, and Python 3 for the simple local preview. Ensure `nift` and `bun` are on `PATH`. Dependency installation may require network access; normal builds use this checkout's maintained sources and dependencies.

```sh
bun run install:app
bun run build
bun run serve
```

Open `http://127.0.0.1:4190/`. Output is the **root `public/` directory**. `bun run build:full` forces route rendering and Nift composition while retaining reusable compiled application/content inputs. A fresh application-state build also removes generated caches and application bundles; it is a different workload and does not imply cold OS caches.

Use the root commands for complete publication. The adapted `app/` package's `build` and `build:static` scripts also delegate to this root pipeline. Isolated application compilation or original upstream generator subcommands are not complete publication measurements. Bare `nift build` invokes preparation through its project hook; for additions/removals that change the tracked inventory, use `bun run build` so Nift loads newly registered routes.

The Python preview serves generated files and does not implement Vercel redirects, conditional Markdown negotiation or deployment-specific fallback rules. Deep links with generated `index.html` files are directly usable. Hosting-rule certification uses the root hosting configuration separately.

## Maintained source and architecture

- Author documents in `app/content/docs/{en,zh-CN}` and shared includes in `app/content/includes`.
- Maintain navigation in upstream `meta.json`/`meta.yaml` structures and API sources in `app/content/openapi`.
- Retain application components, Router routes, styles and client behavior in `app/src`.
- Preserve upstream authoring conventions and plugins in `app/source.config.ts`; see `app/docs/agents/markdown-authoring-standard.md`.

```text
maintained Markdown/MDX, includes, navigation and OpenAPI
  → independent Fumadocs compiler + explicit dependency caches
  → React ESM and content metadata
  → upstream semantic payload/search/Markdown/LLM projections
  → retained TanStack application bundle + route SSR
  → Nift composition + maintained static assets
  → public/
```

The compiler uses bounded sequential process lifetimes and supported Fumadocs plugins; application code is not bundled into every document. Route SSR runs through bounded renderer workers. Runtime bridges reuse the application's React/component instances for SSR and browser loading. TanStack hydration, routing, client navigation, history and interactive MDX components remain meaningful parts of the architecture. Vite still builds the reusable TanStack application. This is a combined pipeline, not a claim that Nift replaces React/Vite compilation.

Generated `app/public/__nift`, `app/public/__static`, `app/dist`, `.generated`, `content/generated` and root `public` are rebuildable products. They are not authored sources. See [tools/CONTENT-COMPILER.md](tools/CONTENT-COMPILER.md) for bounded compiler diagnostics and source restoration checks.

## Dates, regions and external services

`app/src/generated/docs-last-updated-manifest.ts` is an intentionally maintained **immutable seed from the pinned upstream full Git history**. It preserves upstream document dates across migration imports and fresh clones. Do not regenerate it from this experiment's unrelated import commits. Intentional editorial date changes/new paths use [tools/SOURCE-DATES.md](tools/SOURCE-DATES.md); do not silently use build time as a document date. The command changes only named entries and has a documented application/payload invalidation boundary.

The default publication is upstream global/English. CN/Chinese is a separate production configuration and must supply both `VITE_DOCS_REGION=cn` and its intended `SITE_URL`; the root pipeline exposes that same origin as `VITE_SITE_URL` for browser hydration; locale-specific routes, external links and search behavior need separate certification. Sources contain both languages; that does not mean one regional build emits both complete publications.

Global search retains the upstream Algolia service contract and local Orama fallback. Updating external Algolia indices (`search:sync`) is outside the production build and requires its own authorized workflow/credentials. CDN images and external services remain upstream references unless explicitly frozen. API playground behavior follows upstream; no new private service capability is claimed.

## Hosting and evidence

Root `vercel.json` retains upstream redirects, conditional routes and `bulkRedirectsPath`; its install/build/output settings target this repository and `public/`. `vercel-legacy-redirects.json` is copied without changing its rules. Root `vercel.base.json` preserves its corresponding upstream contract. The reference `app/serve.json` points to `_shell.html`, which is not a migrated output, so that rewrite is not copied to the root. Publication includes route HTML plus the application index/404; do not redirect existing assets or pages to a nonexistent shell. A deployment build image must provide the verified Nift CLI; the install command installs app dependencies, not Nift. These files are hosting adapters, not deployment certification.

Keep raw benchmark results, full logs, screenshots and frozen references outside the source repository in canonical experiment evidence storage. Preserve complete pipeline/component accounting, serialized samples, aggregate process-tree RSS, cache definitions and incremental/forced correctness. Independent clean-clone corpus certification has passed. Benchmark observations and raw evidence remain private outside this repository. No Labs publication is authorized.

The pinned three-page projection fallback is documented in [tools/PROJECTION-COMPATIBILITY.md](tools/PROJECTION-COMPATIBILITY.md). It preserves upstream downloads and payload metadata without disabling the working browser article modules.

Compiler/projection metadata has a compact frontmatter index and lazily loaded per-document files for server rendering. These are derived private artifacts, not another maintained source model. The complete catalog remains authoritative for projection conversion. Renderer workers use production React; bounded process lifetimes prevent unbounded module retention.
