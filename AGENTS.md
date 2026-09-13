# Resumilio agent instructions

## Product invariant

The person is the public identity. Resumilio is the engine. Preserve stable graph IDs, complete English and Spanish copy, truthful lifecycle labels, explicit provenance, evidence strength, and reciprocal relationships in every transformation.

## Safety boundary

- Treat every tracked file as public.
- Never add private résumé artifacts, addresses, phone numbers, credentials, tokens, session state, internal control-plane links, or non-public source locators.
- Do not convert `proposal` or `working-prelaunch` work into shipped or production language.
- Do not expose a URL for restricted, private-reference, or public-summary evidence.
- The CLI `deploy` command builds local artifacts only. Repository publication scripts require the explicit release envelope documented in `docs/deployment.md`.

## Change discipline

- Change the v1 schema only with a documented compatibility decision.
- Keep experience levels limited to guidance and choices; they must produce the same profile contract.
- Add contract tests for CLI or MCP behavior changes.
- Run `npm run phase6` and `git diff --check` before delivery.
