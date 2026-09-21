import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { ResumilioProfile } from "./profile.js";
import { readProfile, updateIdentity, upsertCareerItem, upsertConnection, upsertOrganization, upsertResource, validateProfile } from "./operations.js";
import { RESUMILIO_VERSION } from "./version.js";

const json = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] });
const record = z.record(z.string(), z.unknown());

export function createResumilioMcpServer(defaultProfilePath = "resumilio.json"): McpServer {
  const server = new McpServer({ name: "resumilio", version: RESUMILIO_VERSION });
  const common = { profilePath: z.string().default(defaultProfilePath), expectedRevision: z.string().optional() };
  server.registerTool("profile_read", { description: "Read the validated public career profile and its revision.", inputSchema: { profilePath: z.string().default(defaultProfilePath) } }, async ({ profilePath }) => json(await readProfile(profilePath)));
  server.registerTool("profile_update_identity", { description: "Update identity, locales, and contact routes.", inputSchema: { ...common, value: record } }, async ({ profilePath, expectedRevision, value }) => json(await updateIdentity(profilePath, value as unknown as ResumilioProfile["profile"], expectedRevision)));
  server.registerTool("organization_upsert", { description: "Create or update an employer, client, school, or publisher.", inputSchema: { ...common, value: record } }, async ({ profilePath, expectedRevision, value }) => json(await upsertOrganization(profilePath, value as unknown as ResumilioProfile["organizations"][number], expectedRevision)));
  server.registerTool("career_item_upsert", { description: "Create or update a role, project, education item, certification, publication, or skill.", inputSchema: { ...common, value: record } }, async ({ profilePath, expectedRevision, value }) => json(await upsertCareerItem(profilePath, value as unknown as ResumilioProfile["careerItems"][number], expectedRevision)));
  server.registerTool("resource_upsert", { description: "Create or update a live demo, external preview, public repository, online certificate, work sample, or NDA-protected summary.", inputSchema: { ...common, value: record } }, async ({ profilePath, expectedRevision, value }) => json(await upsertResource(profilePath, value as unknown as ResumilioProfile["resources"][number], expectedRevision)));
  server.registerTool("connection_upsert", { description: "Create or update a navigable relationship between career items.", inputSchema: { ...common, value: record } }, async ({ profilePath, expectedRevision, value }) => json(await upsertConnection(profilePath, value as unknown as ResumilioProfile["connections"][number], expectedRevision)));
  server.registerTool("profile_validate", { description: "Validate profile content, private-resource rules, and graph navigation health.", inputSchema: { profilePath: z.string().default(defaultProfilePath) } }, async ({ profilePath }) => json(await validateProfile(profilePath)));
  return server;
}
