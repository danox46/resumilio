# MCP authoring interface

Run `npx resumilio-mcp` from a generated project. Set `RESUMILIO_PROFILE` only when the profile is not `resumilio.json`.

Mutation tools accept an optional `expectedRevision`. Read first, pass the returned revision, and re-read on conflict. Successful mutations validate the complete profile and return a new revision, validation summary, and graph health.

Available tools: `profile_read`, `profile_update_identity`, `organization_upsert`, `career_item_upsert`, `resource_upsert`, `connection_upsert`, and `profile_validate`.
