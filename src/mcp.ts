import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { ResumilioProfile } from "./profile.js";
import { buildLocalDeployment, buildLocalPreview, linkPublicSource, readProfile, updateClaim, validateClaims } from "./operations.js";
import { RESUMILIO_VERSION } from "./version.js";

const text = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] });

export function createResumilioMcpServer(defaultProfilePath = "resumilio.json"): McpServer {
  const server = new McpServer({ name: "resumilio", version: RESUMILIO_VERSION });

  server.registerTool("profile_read", {
    description: "Read a validated, public Resumilio profile graph.",
    inputSchema: { profilePath: z.string().default(defaultProfilePath) },
  }, async ({ profilePath }) => text(await readProfile(profilePath)));

  server.registerTool("profile_update_claim", {
    description: "Update one existing public claim by stable ID; the complete profile must remain valid.",
    inputSchema: {
      profilePath: z.string().default(defaultProfilePath),
      claim: z.record(z.string(), z.unknown()).describe("Complete claim object using the Resumilio v1 schema."),
    },
  }, async ({ profilePath, claim }) => {
    const profile = await updateClaim(profilePath, claim as unknown as ResumilioProfile["claims"][number]);
    return text({ ok: true, profile: profile.profile.id, claimId: claim.id });
  });

  server.registerTool("source_link", {
    description: "Create or update public-source evidence and link it reciprocally to an existing claim.",
    inputSchema: {
      profilePath: z.string().default(defaultProfilePath),
      claimId: z.string(), evidenceId: z.string(), url: z.url(), labelEn: z.string().min(1), labelEs: z.string().min(1),
      observedAt: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/),
    },
  }, async ({ profilePath, ...input }) => {
    const profile = await linkPublicSource(profilePath, input);
    return text({ ok: true, profile: profile.profile.id, claimId: input.claimId, evidenceId: input.evidenceId });
  });

  server.registerTool("claims_validate", {
    description: "Validate schema, lifecycle wording, bilingual copy, evidence reciprocity, graph references, and constellation navigation health.",
    inputSchema: { profilePath: z.string().default(defaultProfilePath) },
  }, async ({ profilePath }) => text(await validateClaims(profilePath)));

  server.registerTool("preview_build", {
    description: "Build a local HTML preview from a valid public profile.",
    inputSchema: { profilePath: z.string().default(defaultProfilePath), outputDirectory: z.string(), locale: z.enum(["en", "es"]).default("en") },
  }, async ({ profilePath, outputDirectory, locale }) => text({ ok: true, output: await buildLocalPreview(profilePath, outputDirectory, locale) }));

  server.registerTool("deployment_artifacts_build", {
    description: "Build sanitized local static artifacts. This does not publish or deploy them.",
    inputSchema: { profilePath: z.string().default(defaultProfilePath), outputDirectory: z.string(), locale: z.enum(["en", "es"]).default("en") },
  }, async ({ profilePath, outputDirectory, locale }) => text({ ok: true, mode: "local-artifacts-only", artifacts: await buildLocalDeployment(profilePath, outputDirectory, locale) }));

  return server;
}
