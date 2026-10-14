Source dates preserve the pinned upstream Git-derived manifest.

For an editorial update, run an explicit deterministic maintenance command:

```sh
bun tools/update-last-updated.ts --iso 2026-10-15T00:00:00.000Z en/introduction/about-agora.mdx
```

Authored projects validate the source file; rendered projects validate the
maintained catalog key. The command changes only named date entries and retains
all imported dates. Commit the date update with the related content change.
Normal publication never reads the current clock or resets the corpus dates
to the migration/import commit.

The generated date manifest is included in the payload adapter's structural
dependency signature. A date edit currently triggers full payload derivation
and application rebuild because the manifest lives under application source.
This metadata invalidation boundary is explicit; date-only incremental
isolation is future tooling work rather than an unsupported benchmark claim.
