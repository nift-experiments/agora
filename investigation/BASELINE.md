# Upstream baseline — in progress

Repository: https://github.com/AgoraIO/docs-portal
Pinned commit: `3c6552914e6cec74ab5d9c38b3bd4eeb51871d13` (2026-10-14T17:21:14+05:00).
Source model intent: authored.

Full-history immutable reference: separate agora-baseline/upstream. Disposable full-history build checkout: agora-baseline/build. Original source is not edited. Dependency acquisition uses the pinned bun.lock and its required Fumadocs patch.

Verified inventory: 1,657 Markdown/MDX sources (937 en, 720 zh-CN), 17 OpenAPI JSON/YAML specifications. File counts are not published route counts. Default region is global/en; cn/zh-CN is a separate production configuration.

Production command: `bun run build`, including legacy redirect checks, OpenAPI synchronization, Git-derived last-updated metadata, static payload generation, Vite/TanStack Start application compilation and route HTML generation. Payload and route generators also execute Vite internally. Full Git history is required for metadata fidelity. No migration content translation until complete baseline is frozen.

Environment initially: Nift 4.12.0, Node 22.22.1 (upstream supports >=22.12), Bun 1.4.3. CI uses Node 24 and Bun latest; toolchain alignment is being investigated before accepted timing.

Global Algolia indexing is a workflow/external service operation, not part of `bun run build`; local fallback uses Orama. Record both publication and service boundaries honestly. OpenAPI playground is disabled upstream.

Measurements pending: five serialized observations per scenario with mandatory sampled aggregate process-tree RSS and separate individual process RSS; OS caches uncontrolled. Setup excluded from build time and measured separately where useful.
