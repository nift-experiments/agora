# EXTERNAL-INPUTS.md

A pinned Git SHA does not necessarily define the complete production input
set. Inventory inputs that can move independently of Git or the toolchain.

Only fill in rows that apply; this is a checklist, not bureaucracy.

## Inventory

For each relevant input record: source URL/system; version/revision; captured
body/hash; capture date; deterministic (yes/no/unknown); can move independently
of Git SHA (yes/no); credentials required; cache boundary; must be frozen for
parity (yes/no).

| Input | Source | Version/revision | Captured hash | Date | Deterministic | Moves w/o Git | Creds | Cache boundary | Freeze |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| | | | | | | | | | |

## Categories to consider

- network-fetched inputs;
- registry-derived inputs;
- generated API/reference data;
- environment-derived inputs;
- tool-version-derived inputs;
- search/index inputs;
- other generated publication inputs.
