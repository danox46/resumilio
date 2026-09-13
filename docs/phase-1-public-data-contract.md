# Phase 1 public-data contract

## Contract boundary

`profiles/daniel.json` is a sanitized public seed, not a résumé archive. It contains only claims and contact routes approved for public use. Private source artifacts stay outside the repository; a public evidence record may disclose that restricted evidence exists without exposing its locator or contents.

The machine contract is `schemas/profile.v1.schema.json`. The TypeScript validator adds graph rules that JSON Schema cannot express cleanly:

- every claim links to at least one evidence record;
- claim-to-evidence references are reciprocal;
- evidence and relationship targets cannot be orphaned;
- identifiers are unique across the graph;
- English and Spanish are complete for every public localized field;
- working-prelaunch work cannot be promoted by wording to a later release stage;
- restricted or private-reference evidence cannot expose a URL;
- public contact routes are limited to the approved kinds and origins.

## Lifecycle is not evidence strength

Lifecycle answers where the work reached: `idea`, `proposal`, `working-prelaunch`, `shipped`, `production`, `completed`, or `retired`.

Evidence strength answers what supports the claim: `self-attested`, `corroborated`, or `primary`.

These dimensions never imply one another. A shipped claim may still rely on a public summary of restricted evidence, while a proposal can have primary public repository evidence.

## Daniel seed decisions

- Professional OpenAI-assisted HubSpot work is `working-prelaunch`.
- The professional HubSpot SMS app is `shipped` and explicitly non-AI.
- Masglo is a `proposal` and portfolio project, not paid client work.
- The verified Coursera course is `completed`; its private credential is represented only by a sanitized public summary.

## Publication rule

Future exports may transform this profile for pages, search, graph, or agent interfaces, but they must preserve stable IDs and cannot weaken lifecycle, provenance, evidence-strength, visibility, or locale constraints.

