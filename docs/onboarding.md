# Onboarding modes

`resumilio init --level <level>` supports three ways of explaining the same workflow:

- `nontechnical` gives concrete editing instructions and plain-language next steps.
- `intermediate` introduces the profile graph and claim-bundle ingestion.
- `advanced` emphasizes stable IDs, deterministic automation, and the MCP interface.

The level is stored in `resumilio.config.json`. It never changes the profile schema, starter facts, validation policy, or generated artifact. Tests initialize and deploy all three modes and compare the resulting public profiles byte for byte.

The default is `nontechnical`. People can change the level later without migrating their profile.
