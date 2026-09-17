# Local MCP server

The Resumilio MCP server uses stdio and the same deterministic operations as the CLI.

## Start

```sh
npm run build
node dist/mcp-server.js --profile ./resumilio.json
```

## Tools

| Tool | Effect |
| --- | --- |
| `profile_read` | Read a validated public profile. |
| `profile_update_claim` | Replace one existing claim by stable ID, subject to full validation. |
| `source_link` | Add or update public-source evidence and reciprocal claim linkage. |
| `claims_validate` | Validate schema and semantic graph rules, then report semantic components and guaranteed constellation reachability. |
| `preview_build` | Build a local HTML preview. |
| `deployment_artifacts_build` | Build sanitized local HTML and JSON artifacts without publishing. |

The server accepts no password, token, cookie, authorization header, private key, or model key. It does not provide arbitrary filesystem, shell, HTTP, or deployment operations. A caller must explicitly supply local output paths for artifact creation.
