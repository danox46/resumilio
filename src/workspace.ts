import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { ResumilioProfile } from "./profile.js";
import { createStarterProfile } from "./starter.js";
import { validateProfileDocument } from "./validation.js";

export type ExperienceLevel = "nontechnical" | "intermediate" | "advanced";

export interface WorkspaceConfig {
  schemaVersion: 1;
  experienceLevel: ExperienceLevel;
  profile: string;
}

export interface IngestBundle {
  kind: "claim-bundle";
  organizations?: ResumilioProfile["organizations"];
  claims: ResumilioProfile["claims"];
  evidence: ResumilioProfile["evidence"];
  relationships?: ResumilioProfile["relationships"];
}

export const defaultProfileName = "resumilio.json";

export async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8"));
}

export async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function initializeWorkspace(directory: string, experienceLevel: ExperienceLevel): Promise<{ profilePath: string; configPath: string }> {
  const target = resolve(directory);
  const profilePath = resolve(target, defaultProfileName);
  const configPath = resolve(target, "resumilio.config.json");
  await mkdir(target, { recursive: true });
  await writeJson(profilePath, createStarterProfile());
  await writeJson(configPath, { schemaVersion: 1, experienceLevel, profile: defaultProfileName } satisfies WorkspaceConfig);
  return { profilePath, configPath };
}

function upsertById<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const result = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) result.set(item.id, item);
  return [...result.values()];
}

export async function ingestDocument(inputPath: string, profilePath: string): Promise<ResumilioProfile> {
  const incoming = await readJson(resolve(inputPath));
  const fullResult = validateProfileDocument(incoming);
  if (fullResult.valid) {
    await writeJson(resolve(profilePath), incoming);
    return incoming as ResumilioProfile;
  }

  const bundle = incoming as Partial<IngestBundle>;
  if (bundle.kind !== "claim-bundle" || !Array.isArray(bundle.claims) || !Array.isArray(bundle.evidence)) {
    throw new Error(`Input is neither a valid Resumilio profile nor a claim-bundle:\n${fullResult.errors.join("\n")}`);
  }

  const current = await readJson(resolve(profilePath)) as ResumilioProfile;
  const merged: ResumilioProfile = {
    ...current,
    organizations: upsertById(current.organizations, bundle.organizations ?? []),
    claims: upsertById(current.claims, bundle.claims),
    evidence: upsertById(current.evidence, bundle.evidence),
    relationships: upsertById(current.relationships, bundle.relationships ?? []),
  };
  const result = validateProfileDocument(merged);
  if (!result.valid) throw new Error(`Ingest would create an invalid profile:\n${result.errors.join("\n")}`);
  await writeJson(resolve(profilePath), merged);
  return merged;
}

export async function loadValidProfile(profilePath: string): Promise<ResumilioProfile> {
  const value = await readJson(resolve(profilePath));
  const result = validateProfileDocument(value);
  if (!result.valid) throw new Error(result.errors.join("\n"));
  return value as ResumilioProfile;
}

export function guidanceFor(level: ExperienceLevel): { label: string; next: string[] } {
  const guidance = {
    nontechnical: {
      label: "Guided",
      next: ["Open resumilio.json and replace the starter text.", "Keep both English and Spanish fields filled.", "Run resumilio validate when ready."],
    },
    intermediate: {
      label: "Builder",
      next: ["Edit the bilingual profile graph.", "Use claim-bundle ingestion for additional facts.", "Validate before preview or export."],
    },
    advanced: {
      label: "Protocol",
      next: ["Maintain stable graph IDs and reciprocal evidence edges.", "Use deterministic CLI artifacts in automation.", "Expose local operations through the stdio MCP server."],
    },
  } satisfies Record<ExperienceLevel, { label: string; next: string[] }>;
  return guidance[level];
}
