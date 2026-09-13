# Machine interfaces and bilingual discovery

Resumilio publishes the same validated profile contract for people, search engines, and agents. Every localized claim includes a canonical evidence-page URL, and every evidence reference resolves on that page in one hop.

## Public endpoints

English endpoints live at the root; Spanish equivalents use `/es/`.

- `resume.json` — localized person and claim export with one-hop evidence citations.
- `evidence.json` — evidence lifecycle, strength, visibility, source, and claim references.
- `graph.json` — localized person, organization, claim, and evidence nodes plus explicit and derived support edges.
- `search-index.json` — deterministic no-model search documents.
- `llms.txt` — concise profile and retrieval index.
- `llms-full.txt` — full sanitized claims and evidence citations.
- `.well-known/resumilio` and `.well-known/resumilio.json` — capability, locale, schema, citation, and local MCP discovery.
- `schemas/*.json` — versioned profile and public-export schemas.

JSON and text responses declare language, safe content type, and shared-cache policy. The static package includes a `_headers` policy for compatible hosts.

## Canonical origin

Local and CI builds use the reserved `https://resumilio.example` origin so canonical, hreflang, sitemap, and agent contracts can be validated before publication without implying a live destination. Set `PUBLIC_SITE_ORIGIN` to the exact verified public origin when building a deployable release. Phase 6 must reject the reserved origin before publication.

## Structured evidence pages

Each claim has an English `/evidence/{claim-id}/` route and a Spanish `/es/evidencia/{claim-id}/` peer. Pages include symmetric hreflang links, localized social metadata, and a JSON-LD graph derived only from the validated profile. `Person`, `ProfilePage`, and `CreativeWork` are present; the public Masglo repository is additionally typed as `SoftwareSourceCode`.

## Agent discovery

The well-known manifest advertises profile, evidence, graph, search, schema, and citation capabilities. It also lists the six bounded local stdio MCP tools from the package. No runtime model, API key, authenticated service, tracking identifier, or cross-session state is required.
