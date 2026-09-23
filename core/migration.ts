import { z } from "zod";
import { analyzeGraphHealth } from "./graph.js";
import type { ResumilioProfile } from "./profile.js";
import { assertValidProfile } from "./validation.js";

const id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const localized = z.object({ en: z.string().min(1), es: z.string().min(1) }).strict();
const httpsUrl = z.string().regex(/^https:\/\/[^\s]+$/);
const legacyReference = z.object({
  schemaVersion: z.literal("1.0.0"),
  profile: z.object({
    id, name: localized, headline: localized, summary: localized,
    defaultLocale: z.enum(["en", "es"]),
    locales: z.array(z.enum(["en", "es"])).min(1),
    contacts: z.array(z.object({ id, kind: z.enum(["github", "linkedin", "portfolio", "email"]), label: localized, url: z.string().regex(/^(https:\/\/|mailto:)[^\s]+$/) }).strict()).min(1),
  }).strict(),
  organizations: z.array(z.object({ id, name: localized, url: httpsUrl.optional() }).strict()),
  claims: z.array(z.object({
    id, type: z.enum(["experience", "project", "education", "certification", "publication", "skill"]),
    lifecycle: z.enum(["idea", "proposal", "working-prelaunch", "shipped", "production", "completed", "retired"]),
    title: localized, summary: localized, organizationId: id.optional(), evidenceIds: z.array(id), tags: z.array(id),
  }).strict()).min(1),
  evidence: z.array(z.object({
    id, claimIds: z.array(id).min(1), title: localized,
    evidenceType: z.enum(["public-source", "owner-attestation", "repository", "credential", "artifact"]),
    strength: z.enum(["self-attested", "corroborated", "primary"]),
    lifecycle: z.enum(["available", "restricted", "archived", "unavailable"]),
    source: z.object({ label: localized, visibility: z.enum(["public", "public-summary", "private-reference"]), url: httpsUrl.optional() }).strict(),
    observedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }).strict()).min(1),
  relationships: z.array(z.object({ id, type: z.enum(["performed-for", "provided-by", "supports", "related-to"]), sourceId: id, targetId: id }).strict()),
}).strict();

const localizedAny = z.record(z.string(), z.string().min(1));
const earlyPackage = z.object({
  schemaVersion: z.literal("1.0.0"),
  profile: z.object({
    id, name: localizedAny, headline: localizedAny, summary: localizedAny,
    defaultLocale: z.string().min(2), locales: z.array(z.string().min(2)).min(1),
    contacts: z.array(z.object({ id, kind: z.enum(["github", "linkedin", "portfolio", "email", "meeting", "other"]), label: localizedAny, url: z.string().regex(/^(https:\/\/|mailto:)[^\s]+$/) }).strict()).min(1),
  }).strict(),
  organizations: z.array(z.object({ id, name: localizedAny, url: httpsUrl.optional() }).strict()),
  careerItems: z.array(z.object({
    id, kind: z.enum(["role", "project", "education", "certification", "publication", "skill"]),
    state: z.enum(["current", "available", "completed", "in-development", "archived"]),
    title: localizedAny, summary: localizedAny, organizationId: id.optional(),
    startDate: z.string().optional(), endDate: z.string().optional(), resourceIds: z.array(id), tags: z.array(id),
  }).strict()).min(1),
  resources: z.array(z.object({
    id, careerItemIds: z.array(id).min(1), label: localizedAny,
    kind: z.enum(["live-demo", "external-preview", "public-repository", "online-certificate", "work-sample", "nda-protected"]),
    availability: z.enum(["public", "restricted", "unavailable"]), url: httpsUrl.optional(),
  }).strict()),
  connections: z.array(z.object({
    id, sourceId: id, targetId: id, kind: z.enum(["related-to", "built-on", "performed-for", "learned-through"]),
  }).strict()),
}).strict();

type LegacyReference = z.infer<typeof legacyReference>;

export interface MigrationReceipt {
  sourceFormat: "reference-v1" | "package-v1";
  targetVersion: "2.0.0";
  counts: { careerItems: number; resources: number; connections: number };
  graph: { connected: boolean; componentCount: number; mobileVarietyReady: boolean; desktopVarietyReady: boolean };
  review: Array<{ path: string; action: string }>;
}

export interface MigrationResult { profile: ResumilioProfile; receipt: MigrationReceipt }

function receiptFor(profile: ResumilioProfile, sourceFormat: MigrationReceipt["sourceFormat"], review: MigrationReceipt["review"]): MigrationReceipt {
  const graph = analyzeGraphHealth(profile);
  return {
    sourceFormat,
    targetVersion: "2.0.0",
    counts: { careerItems: profile.careerItems.length, resources: profile.resources.length, connections: profile.connections.length },
    graph: { connected: graph.connected, componentCount: graph.connectedComponents.length, mobileVarietyReady: graph.mobileVarietyReady, desktopVarietyReady: graph.desktopVarietyReady },
    review,
  };
}

function validateLinks(source: LegacyReference): void {
  const allIds = [source.profile.id, ...source.profile.contacts.map((item) => item.id), ...source.organizations.map((item) => item.id), ...source.claims.map((item) => item.id), ...source.evidence.map((item) => item.id), ...source.relationships.map((item) => item.id)];
  if (new Set(allIds).size !== allIds.length) throw new Error("Reference v1 contains duplicate IDs; resolve them before import.");
  const organizationIds = new Set(source.organizations.map((item) => item.id));
  const claims = new Map(source.claims.map((item) => [item.id, item]));
  const evidence = new Map(source.evidence.map((item) => [item.id, item]));
  const graphIds = new Set([source.profile.id, ...organizationIds, ...claims.keys(), ...evidence.keys()]);
  for (const [index, claim] of source.claims.entries()) {
    if (claim.organizationId && !organizationIds.has(claim.organizationId)) throw new Error(`Reference v1 claims[${index}] has an unknown organization.`);
    for (const evidenceId of claim.evidenceIds) if (!evidence.get(evidenceId)?.claimIds.includes(claim.id)) throw new Error(`Reference v1 claims[${index}] has a non-reciprocal evidence link.`);
  }
  for (const [index, record] of source.evidence.entries()) {
    for (const claimId of record.claimIds) if (!claims.get(claimId)?.evidenceIds.includes(record.id)) throw new Error(`Reference v1 evidence[${index}] has a non-reciprocal claim link.`);
  }
  for (const [index, relationship] of source.relationships.entries()) {
    if (!graphIds.has(relationship.sourceId) || !graphIds.has(relationship.targetId)) throw new Error(`Reference v1 relationships[${index}] has an unknown endpoint.`);
  }
}

function referenceToCareer(source: LegacyReference): MigrationResult {
  validateLinks(source);
  const review: MigrationReceipt["review"] = [];
  const kindForType = {
    "public-source": "external-preview", "owner-attestation": "career-note", repository: "public-repository", credential: "online-certificate", artifact: "work-sample",
  } as const;
  const profile: ResumilioProfile = {
    schemaVersion: "2.0.0",
    profile: source.profile,
    organizations: source.organizations,
    careerItems: source.claims.map((claim) => ({
      id: claim.id,
      kind: claim.type === "experience" ? "role" : claim.type,
      state: claim.lifecycle,
      title: claim.title,
      summary: claim.summary,
      ...(claim.organizationId ? { organizationId: claim.organizationId } : {}),
      resourceIds: claim.evidenceIds,
      tags: claim.tags,
    })),
    resources: source.evidence.map((record, index) => {
      const linkIsPublic = record.source.visibility === "public" && record.lifecycle === "available" && Boolean(record.source.url);
      if (!linkIsPublic) review.push({ path: `evidence[${index}].source.label`, action: "Source label withheld from the public profile because this resource is not currently public and available; review the original privately." });
      if (record.source.url && !linkIsPublic) review.push({ path: `evidence[${index}].source.url`, action: "Source URL withheld because availability or visibility is not public." });
      if (record.source.visibility === "public" && record.lifecycle === "available" && !record.source.url) review.push({ path: `evidence[${index}].source.url`, action: "No public URL supplied; resource remains restricted until reviewed." });
      return {
        id: record.id,
        careerItemIds: record.claimIds,
        label: record.title,
        kind: kindForType[record.evidenceType],
        availability: linkIsPublic ? "public" : record.lifecycle === "archived" || record.lifecycle === "unavailable" ? "unavailable" : "restricted",
        ...(linkIsPublic && record.source.url ? { url: record.source.url } : {}),
        provenance: {
          recordType: record.evidenceType,
          strength: record.strength,
          lifecycle: record.lifecycle,
          visibility: record.source.visibility,
          observedAt: record.observedAt,
          ...(linkIsPublic ? { sourceLabel: record.source.label } : {}),
        },
      };
    }),
    connections: source.relationships.map((relationship) => ({ id: relationship.id, sourceId: relationship.sourceId, targetId: relationship.targetId, kind: relationship.type })),
  };
  assertValidProfile(profile);
  return { profile, receipt: receiptFor(profile, "reference-v1", review) };
}

export function migrateProfileDocument(input: unknown): MigrationResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Profile must be a JSON object.");
  const value = input as Record<string, unknown>;
  if (value.schemaVersion === "2.0.0") throw new Error("This profile is already v2; no migration is needed.");
  if (value.schemaVersion !== "1.0.0") throw new Error("Unsupported profile version; expected reference v1 or package v1.");
  if ("claims" in value || "evidence" in value || "relationships" in value) {
    const parsed = legacyReference.safeParse(value);
    if (!parsed.success) throw new Error(`Invalid reference v1 profile at: ${parsed.error.issues.map((issue) => issue.path.join(".") || "root").join(", ")}.`);
    return referenceToCareer(parsed.data);
  }
  if ("careerItems" in value && "resources" in value && "connections" in value) {
    const parsed = earlyPackage.safeParse(value);
    if (!parsed.success) throw new Error(`Invalid package v1 profile at: ${parsed.error.issues.map((issue) => issue.path.join(".") || "root").join(", ")}.`);
    const review: MigrationReceipt["review"] = [];
    const resources = parsed.data.resources.map((resource, index) => {
      if (resource.availability !== "public" && resource.url) {
        const publicRecord = { ...resource };
        delete publicRecord.url;
        review.push({ path: `resources[${index}].url`, action: "Non-public resource URL withheld; review the original privately." });
        return publicRecord;
      }
      return resource;
    });
    const profile = { ...parsed.data, schemaVersion: "2.0.0", resources };
    assertValidProfile(profile);
    return { profile, receipt: receiptFor(profile, "package-v1", review) };
  }
  throw new Error("Unknown v1 profile shape; expected claims/evidence/relationships or careerItems/resources/connections.");
}
