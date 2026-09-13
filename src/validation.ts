import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import type { ResumilioProfile } from "./profile.ts";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const schemaPath = fileURLToPath(new URL("../schemas/profile.v1.schema.json", import.meta.url));
const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true });
const validateSchema = ajv.compile(schema);

const approvedContactHosts = new Map([
  ["github", new Set(["github.com"])],
  ["linkedin", new Set(["www.linkedin.com", "linkedin.com"])],
  ["portfolio", new Set(["danienremoto.com", "www.danienremoto.com"])],
]);

function localizedValues(value: { en: string; es: string }): string[] {
  return [value.en, value.es];
}

export function validateProfileDocument(value: unknown): ValidationResult {
  const errors: string[] = [];
  if (!validateSchema(value)) {
    errors.push(...(validateSchema.errors ?? []).map((error) => `${error.instancePath || "/"} ${error.message}`));
    return { valid: false, errors };
  }

  const document = value as ResumilioProfile;
  const ids = new Set<string>();
  const registerId = (id: string, kind: string) => {
    if (ids.has(id)) errors.push(`Duplicate graph id ${id} (${kind}).`);
    ids.add(id);
  };

  registerId(document.profile.id, "profile");
  for (const contact of document.profile.contacts) registerId(contact.id, "contact");
  for (const organization of document.organizations) registerId(organization.id, "organization");
  for (const claim of document.claims) registerId(claim.id, "claim");
  for (const item of document.evidence) registerId(item.id, "evidence");
  for (const relationship of document.relationships) registerId(relationship.id, "relationship");

  const organizations = new Set(document.organizations.map((item) => item.id));
  const claims = new Map(document.claims.map((item) => [item.id, item]));
  const evidence = new Map(document.evidence.map((item) => [item.id, item]));
  const graphTargets = new Set([document.profile.id, ...organizations, ...claims.keys(), ...evidence.keys()]);

  for (const claim of document.claims) {
    if (claim.organizationId && !organizations.has(claim.organizationId)) {
      errors.push(`Claim ${claim.id} references missing organization ${claim.organizationId}.`);
    }
    for (const evidenceId of claim.evidenceIds) {
      const item = evidence.get(evidenceId);
      if (!item) errors.push(`Claim ${claim.id} references missing evidence ${evidenceId}.`);
      else if (!item.claimIds.includes(claim.id)) errors.push(`Claim ${claim.id} and evidence ${evidenceId} are not reciprocal.`);
    }
    if (claim.lifecycle === "working-prelaunch") {
      const forbiddenReleaseLanguage = /\b(production|launched|live in production|producci[oó]n|lanzad[oa])\b/i;
      if ([...localizedValues(claim.title), ...localizedValues(claim.summary)].some((text) => forbiddenReleaseLanguage.test(text))) {
        errors.push(`Working-prelaunch claim ${claim.id} uses a later-stage release label.`);
      }
    }
  }

  for (const item of document.evidence) {
    for (const claimId of item.claimIds) {
      const claim = claims.get(claimId);
      if (!claim) errors.push(`Evidence ${item.id} references missing claim ${claimId}.`);
      else if (!claim.evidenceIds.includes(item.id)) errors.push(`Evidence ${item.id} and claim ${claimId} are not reciprocal.`);
    }
    if (item.source.visibility !== "public" && item.source.url) {
      errors.push(`Non-public evidence ${item.id} must not expose a source URL.`);
    }
    if (["public-source", "repository"].includes(item.evidenceType) && !item.source.url) {
      errors.push(`Public evidence ${item.id} requires a source URL.`);
    }
  }

  for (const relationship of document.relationships) {
    if (!graphTargets.has(relationship.sourceId)) errors.push(`Relationship ${relationship.id} has missing source ${relationship.sourceId}.`);
    if (!graphTargets.has(relationship.targetId)) errors.push(`Relationship ${relationship.id} has missing target ${relationship.targetId}.`);
  }

  for (const contact of document.profile.contacts) {
    if (contact.kind === "email") {
      if (contact.url !== "mailto:daniel@danienremoto.com") errors.push(`Email contact ${contact.id} is not approved for publication.`);
      continue;
    }
    try {
      const host = new URL(contact.url).hostname.toLowerCase();
      if (!approvedContactHosts.get(contact.kind)?.has(host)) errors.push(`Contact ${contact.id} uses an unapproved public origin.`);
    } catch {
      errors.push(`Contact ${contact.id} has an invalid URL.`);
    }
  }

  return { valid: errors.length === 0, errors };
}

