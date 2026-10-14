# Pinned machine-readable fallback

The frozen upstream dynamic payload compiler fails to resolve authored local
MDX imports on exactly three corpus pages:

- English regional restrictions.
- Chinese Signaling overview.
- Chinese Signaling billing strategy.

Its browser/Vite article compiler successfully renders those same imports.
Consequently, the upstream page payload has an empty TOC and its Markdown/LLM
projection uses raw authored text rather than processed Markdown.

`app/src/lib/nift-projection-fallbacks.ts` records the exact source paths and
pinned commit provenance. The content adapter preserves this projection
behavior while retaining working React article modules. The projection
generator reads the raw getter for its fallback; authored projects read the
actual file and rendered projects read the maintained catalog's `_raw`.

This is a bounded compatibility rule for the pinned corpus, not a generic
emulation of unresolved JavaScript imports. When deliberately fixing upstream
projection behavior, update this compatibility contract and parity evidence
explicitly.
