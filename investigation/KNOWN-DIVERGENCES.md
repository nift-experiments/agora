# Known differences and limitations

| Area | Classification | Contract |
| --- | --- | --- |
| Application/document JavaScript filenames and deduplication | Intentional migration architecture | Same logical article inventory and React components; independently loaded content-addressed ESM replaces per-document Vite chunks. File counts are accounted by category, not presented as byte-identical bundles. |
| Three authored MDX import projection fallbacks | Inherited upstream behavior | Preserve frozen raw Markdown/search and empty payload TOC when the original dynamic worker cannot resolve the import. Browser article remains interactive. See tools/PROJECTION-COMPATIBILITY.md. |
| Algolia/admin indexing and analytics credentials | External-service qualification | Preserve service configuration and supported Orama fallback; no private index synchronization or live private-service parity claim. |
| CDN images/fonts and external URLs | Retained external contract | Existing upstream URLs remain referenced; this is not a complete offline CDN mirror. |
| CN publication origin | Configuration qualification | Separate CN build requires an explicit SITE_URL. No production Chinese origin is invented from legacy redirect targets. |
| Editorial dates | Explicit maintenance workflow | Imported Git-derived dates preserved; named deterministic updates supported. Date metadata changes currently invalidate payload/app state. |
| Local Python preview | Preview limitation | Generated pages/assets served; deployment redirects and Markdown Accept negotiation belong to preserved hosting rules. |

Final functional, clean-checkout and performance certification is still pending.
