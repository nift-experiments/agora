# Independent authored-content compiler

Run from the repository root:

```sh
bun tools/compile-content.ts --only en/introduction/index.mdx en/introduction/about-agora.mdx
bun tools/compile-corpus.ts
python3 tools/verify-content-compiler.py
```

The first command is bounded; the second inventories/compiles the complete maintained corpus with sequential workers of 64 dirty documents. `NIFT_CONTENT_WORKER_SIZE` overrides that production bound. A separate `--plan` process inventories dirty sources and exits before any compiler worker starts; only compact path lists survive in the parent. Dependency analysis is cached without falsely marking compilation complete. Each worker retains the existing 16-document Bun batch bound, then exits to release native arenas/compiler/highlighter memory. Finalization prunes deleted-source catalog entries once after all workers succeed. `--force` bypasses compiled-content cache reuse; fresh caches still require complete compilation.

`bun tools/compile-content.ts --plan` is the machine-readable planner; `--finalize` reconciles complete source inventory without invoking the MDX compiler. Direct `compile-content.ts` remains useful for bounded debugging. `compile-corpus.ts --only <paths...>` supports bounded multiworker verification without deleting unselected source records. Failed workers stop publication; signals are forwarded to the active child.

The official `fumadocs-mdx/bun` plugin uses maintained `app/source.config.ts` and its `docs` collection. Bounded batches of 16 dirty documents reuse one plugin/core, processors and highlighter; `NIFT_CONTENT_BATCH_SIZE` overrides that bound. Each batch releases raw compiled strings and Bun build artifacts before the next. No Vite application bundle or app component tree is embedded in each document. Generated exports retain validated frontmatter, TOC, structured data, and upstream processed Markdown. Other upstream metadata exports are retained when present.

The maintained highlighting configuration selects Fumadocs' supported `oniguruma` engine. Six representative documents covering C++, Java, C#, Swift, platform/code tabs and both configured themes produced byte-identical modules and metadata versus the original JavaScript regex engine. Whole-corpus comparison remains a publication gate; the sample does not imply exhaustive token equivalence.

Metadata extraction reads compiler-generated static exports from the JavaScript AST instead of importing every document into the compiler's module cache. Literal objects/arrays/strings and explicitly imported JSX constructors for rich TOC titles are supported; arbitrary expressions fail. `bun tools/verify-content-metadata.ts <doc-relative-path> ...` compares a bounded sample with evaluated module exports.

Outputs:

- `app/public/__nift/content/<sha256>.mjs`: content-addressed ESM, identical for browser and SSR.
- `app/public/__nift/content-manifest.json`: doc-relative source path → public module URL.
- `app/public/__nift/content-metadata.json`: metadata only, without React functions.
- `.generated/content-compiler/{state,metadata,last-run}.json`: private cache and run diagnostics.
- `app/public/__nift/runtime-*.mjs`: explicit export bridges to the separately built app's `globalThis.__NIFT_RUNTIME` namespaces.

The runtime must initialize its React/JSX/MDX namespaces before loading content modules. The frozen corpus needs `mdx` and `planCards` component namespaces. Code examples do not count as ESM imports: source inventory uses MDX syntax trees and output rewriting uses JavaScript AST source ranges.

Dependencies include source bytes, compiler implementation, lockfile, source configuration and its transitive local plugins, imported MDX, recursive `<include>` targets, and local images whose dimensions upstream computes. Unchanged sources reuse stored parsed dependency lists. Runtime component edits rebuild the app independently; they do not invalidate document compilation.

Run `bun tools/inventory-mdx-imports.ts` for a read-only real-import inventory. Unknown real component imports fail explicitly instead of silently bundling arbitrary application code. Local file/include cycles fail explicitly. A selected `--only` invocation updates only its selected docs; complete invocations reconcile deleted document manifest entries.

Content metadata catalogs are server-side inputs; do not bundle the entire catalog into every browser entry. Hash-addressed old modules are retained during iteration for stable readers; final publication should copy only manifest-reachable modules and the runtime bridge files. Do not publish cache internals. Neither this compiler nor its smoke probes constitute final whole-site parity certification.
