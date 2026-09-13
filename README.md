# Resumilio

Resumilio is a person-first, evidence-backed living resume engine. The resume owner is the primary public identity; Resumilio is the reusable engine underneath it.

Phase 1 defines the public profile contract and a deliberately small bilingual Daniel seed. It keeps claim lifecycle, provenance, evidence strength, relationships, and translated copy separate so later interfaces cannot flatten truthful distinctions.

## Verify Phase 1

```sh
npm ci
npm run phase1
```

The Phase 1 command type-checks the validator, validates the seed, runs negative contract tests, and scans the public repository surface for private artifacts and unsafe references.

No model key is required.

