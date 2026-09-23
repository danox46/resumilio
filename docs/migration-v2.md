# Profile format v2 and v1 imports

The package version (`0.8.0`) and the public profile format version (`2.0.0`) are independent. New projects use `careerItems`, `resources`, and `connections` with `schemaVersion: "2.0.0"`. Two incompatible historical formats both used `1.0.0`: the original reference profile used `claims`, `evidence`, and `relationships`, while early package starters used the new field names. The importer identifies them by their fields; the v2 validator never treats either as current.

## Preview before writing

From a project with Resumilio installed:

```bash
npx resumilio migrate path/to/old-profile.json
```

This reads the old file, validates its links, and prints a sanitized receipt. It writes nothing. To create a new profile and an adjacent review report:

```bash
npx resumilio migrate path/to/old-profile.json --out path/to/resumilio-v2.json
npx resumilio validate path/to/resumilio-v2.json
```

Neither command changes the original file. The importer refuses to overwrite an existing output or report. Review the new JSON and `resumilio-v2.json.migration-report.json` before replacing a site's `resumilio.json`; preview the site before publishing. Local import does not authorize deployment.

The receipt includes record counts, a graph-health summary, and field paths requiring private review. It contains no source labels, URLs, or career content.

## Mapping and review rules

| Reference v1 | Career profile v2 |
| --- | --- |
| `claims` | `careerItems`; `experience` becomes `role`, other types keep their meaning |
| `claims.lifecycle` | `careerItems.state`, retaining `idea`, `proposal`, `working-prelaunch`, `shipped`, `production`, `completed`, or `retired` exactly |
| `evidence` | `resources` with the same IDs and item links; type, strength, lifecycle, visibility, and observation date remain in optional `provenance` |
| `relationships` | `connections` with the same IDs, endpoints, and relationship kinds, including links to organizations or resources |

Only a source marked **public and available with an HTTPS URL** becomes a public resource link. A private-reference or public-summary source remains unlinked; its source label and locator are omitted from the public profile and called out by path in the review receipt. The original file remains the place to review those details privately. Missing public URLs are not invented. `proposal` and prelaunch work are never promoted to shipped or production. The importer does not infer dates, employers, credentials, or translations.

Connections may join any known graph records. Only career-item-to-career-item connections guide the interactive recommendations; organization and resource connections retain their context in the public graph without manufacturing new career navigation links.

The historical package v1 format gets a version-only upgrade after validation; its existing career content remains unchanged. If a reference file has broken or non-reciprocal links, duplicate IDs, or an unknown shape, import stops instead of producing a partial profile.

The `schemas/profile.v1.schema.json` file remains as a record of the early package v1 shape. It does **not** describe the original reference v1. New profiles use `schemas/profile.v2.schema.json`.
