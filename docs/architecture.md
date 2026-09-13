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

No interface may weaken the contract. A renderer can omit information for a particular view, but it cannot change stable IDs, upgrade lifecycle, invent provenance, or expose a restricted source.

## Trust model

The repository stores only public, sanitized material. Validation is a guardrail, not a guarantee that an arbitrary sentence is true. The profile owner remains responsible for the factual basis and publication authority for each claim. Evidence strength communicates support without pretending that all sources are equally strong.

The MCP server is local and stdio-only. It has no credential inputs and performs no network publication. File access is limited to paths explicitly supplied by the local caller.
