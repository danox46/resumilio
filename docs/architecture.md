# Architecture

Resumilio separates truthful public facts from every presentation and agent interface.

```text
profile JSON
    │
    ├── JSON Schema: shape, enums, bilingual fields
    ├── graph validator: IDs, links, lifecycle and visibility rules
    │
    ├── CLI: init, ingest, validate, preview, export, doctor, deploy
    └── local MCP: bounded read and write operations
              │
              └── deterministic HTML and JSON artifacts
```

## Layers

1. **Contract** — `schemas/profile.v1.schema.json` and `src/profile.ts` define stable data.
2. **Semantic validation** — `src/validation.ts` protects graph integrity and truthful lifecycle language.
3. **Operations** — `src/workspace.ts` and `src/operations.ts` provide deterministic local changes.
4. **Interfaces** — `src/cli.ts` and `src/mcp.ts` call the same operations.
5. **Rendering** — `src/rendering.ts` creates portable, code-native public artifacts.

## Constellation graph health

Author-provided `related-to` relationships remain factual semantic edges; Resumilio never invents them merely to make the interface connected. The constellation renderer overlays two deterministic navigation guarantees instead:

1. Every claim exposes a stable traversal bridge to the next claim in profile order, wrapping the final claim back to the first. Following that bridge can visit the complete profile from any starting claim.
2. When relevance would fill the visible neighborhood with already-opened claims, one slot is reserved for the highest-ranked unexplored claim.

This traversal backbone is presentation metadata, not a public factual relationship. `resumilio validate`, `resumilio doctor`, and the MCP `claims_validate` tool report both the authored semantic topology and the effective navigation guarantee. Sparse or clustered profiles remain navigable while contributors can still see semantic components and orphan claims that may benefit from truthful relationship data.

No interface may weaken the contract. A renderer can omit information for a particular view, but it cannot change stable IDs, upgrade lifecycle, invent provenance, or expose a restricted source.

## Trust model

The repository stores only public, sanitized material. Validation is a guardrail, not a guarantee that an arbitrary sentence is true. The profile owner remains responsible for the factual basis and publication authority for each claim. Evidence strength communicates support without pretending that all sources are equally strong.

The MCP server is local and stdio-only. It has no credential inputs and performs no network publication. File access is limited to paths explicitly supplied by the local caller.
