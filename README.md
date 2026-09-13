# Resumilio

Resumilio is a person-first, evidence-backed living resume engine. The person is the public identity; Resumilio is the reusable engine underneath it.

It starts with a bilingual data contract that keeps claims, lifecycle, provenance, evidence strength, and relationships distinct. A local CLI and MCP server let people or agents maintain the same profile without a model key, proprietary account, or hosted service.

The included web experience turns that contract into an adaptive Evidence Constellation: search and filter the complete public record, open the proof behind a claim, and understand why a related item is recommended. The initial HTML remains complete when JavaScript is unavailable; session adaptation stays local to the current browser tab.

## Start in a fresh directory

```sh
npm install -g resumilio
resumilio init my-profile
cd my-profile
resumilio validate
resumilio preview
resumilio export --format markdown
resumilio deploy
```

Until the package is published to npm, clone this repository, run `npm ci && npm run build`, and use `node /path/to/resumilio/dist/cli.js` with the same commands.

`deploy` deliberately creates sanitized local static artifacts only. It does not publish them or require credentials.

## Commands

| Command | Purpose |
| --- | --- |
| `init` | Create a valid bilingual starter profile and experience-level guidance. |
| `ingest` | Replace a profile with valid JSON or merge a validated `claim-bundle`. |
| `validate` | Check schema, graph integrity, evidence reciprocity, and lifecycle wording. |
| `preview` | Create a local HTML preview. |
| `export` | Export JSON, Markdown, or HTML. |
| `doctor` | Check the runtime and profile without requiring a model key. |
| `deploy` | Build sanitized local static deployment artifacts without publishing. |

Choose `--level nontechnical`, `intermediate`, or `advanced` during `init`. The explanation changes; the generated profile and deployment schema do not.

## Included profiles

- `profiles/starter.json` is a generic bilingual starter.
- `profiles/daniel.json` is a deliberately small public seed that demonstrates truthful lifecycle and evidence distinctions. It is not a private résumé archive.

## Local MCP server

```sh
npm run build
node dist/mcp-server.js --profile ./resumilio.json
```

The stdio server exposes bounded tools to read and update claims, link public sources, validate the graph, preview, and build local deployment artifacts. See `docs/mcp.md`.

## Development

```sh
npm ci
npm run phase3
npm run dev
```

The Phase 3 gate builds the package and bilingual static site, type-checks both, validates the Daniel seed, runs contract, workflow, discovery, and static-experience tests, and scans the public tree. CI also inspects the npm package contents.

## Project documents

- [Architecture](docs/architecture.md)
- [Public data contract](docs/phase-1-public-data-contract.md)
- [Onboarding modes](docs/onboarding.md)
- [Local MCP server](docs/mcp.md)
- [Phase 3 design system](docs/design/phase-3-design-system.md)
- [Phase 3 fidelity ledger](docs/design/phase-3-fidelity-ledger.md)
- [Contributing](CONTRIBUTING.md)
- [Security](SECURITY.md)

Resumilio is available under the MIT License. The project name and marks are covered separately by `TRADEMARKS.md`.
