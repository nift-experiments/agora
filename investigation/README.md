# investigation

Migration investigation state and evidence. These files accumulate during the
migration and are preserved across reruns:

- `STATUS.md` - resumable checkpoint ledger: where the migration is now.
- `BASELINE.md` - upstream reference, source model and frozen baseline.
- `EXTERNAL-INPUTS.md` - external/generated inputs a Git SHA does not capture.
- `KNOWN-DIVERGENCES.md` - divergence ledger (upstream vs migration regression).
- `PARITY-CONTRACT.md` - what parity means for this migration.

Methodology lives in MIGRATION.md. Keep STATUS.md current after each
checkpoint.
