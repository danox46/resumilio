import { resolve } from "node:path";
import type { ResumilioProfile } from "./profile.js";
import { buildDeploymentArtifacts, buildPreview } from "./rendering.js";
import { loadValidProfile, writeJson } from "./workspace.js";
import { validateProfileDocument } from "./validation.js";

export async function readProfile(profilePath: string): Promise<ResumilioProfile> {
  return loadValidProfile(resolve(profilePath));
}

export async function updateClaim(profilePath: string, claim: ResumilioProfile["claims"][number]): Promise<ResumilioProfile> {
  const profile = await loadValidProfile(resolve(profilePath));
  const index = profile.claims.findIndex((item) => item.id === claim.id);
  if (index === -1) throw new Error(`Claim ${claim.id} does not exist; ingest a complete claim-bundle to add a claim.`);
  profile.claims[index] = claim;
  const result = validateProfileDocument(profile);
  if (!result.valid) throw new Error(result.errors.join("\n"));
  await writeJson(resolve(profilePath), profile);
  return profile;
}

export async function linkPublicSource(
  profilePath: string,
  input: { claimId: string; evidenceId: string; url: string; labelEn: string; labelEs: string; observedAt: string },
): Promise<ResumilioProfile> {
  const profile = await loadValidProfile(resolve(profilePath));
  const claim = profile.claims.find((item) => item.id === input.claimId);
  if (!claim) throw new Error(`Claim ${input.claimId} does not exist.`);
  let evidence = profile.evidence.find((item) => item.id === input.evidenceId);
  if (!evidence) {
    evidence = {
      id: input.evidenceId,
      claimIds: [input.claimId],
      title: { en: input.labelEn, es: input.labelEs },
      evidenceType: "public-source",
      strength: "primary",
      lifecycle: "available",
      source: { label: { en: input.labelEn, es: input.labelEs }, visibility: "public", url: input.url },
      observedAt: input.observedAt,
    };
    profile.evidence.push(evidence);
  } else {
    evidence.source = { label: { en: input.labelEn, es: input.labelEs }, visibility: "public", url: input.url };
    evidence.lifecycle = "available";
    evidence.evidenceType = "public-source";
    evidence.strength = "primary";
    evidence.observedAt = input.observedAt;
    if (!evidence.claimIds.includes(input.claimId)) evidence.claimIds.push(input.claimId);
  }
  if (!claim.evidenceIds.includes(input.evidenceId)) claim.evidenceIds.push(input.evidenceId);
  const result = validateProfileDocument(profile);
  if (!result.valid) throw new Error(result.errors.join("\n"));
  await writeJson(resolve(profilePath), profile);
  return profile;
}

export async function validateClaims(profilePath: string): Promise<{ valid: true; claims: number; evidence: number }> {
  const profile = await loadValidProfile(resolve(profilePath));
  return { valid: true, claims: profile.claims.length, evidence: profile.evidence.length };
}

export async function buildLocalPreview(profilePath: string, outputDirectory: string, locale: "en" | "es") {
  return buildPreview(await loadValidProfile(resolve(profilePath)), outputDirectory, locale);
}

export async function buildLocalDeployment(profilePath: string, outputDirectory: string, locale: "en" | "es") {
  return buildDeploymentArtifacts(await loadValidProfile(resolve(profilePath)), outputDirectory, locale);
}
