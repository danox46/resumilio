import { createHash } from "node:crypto";
import { resolve } from "node:path";
import type { ResumilioProfile } from "./profile.js";
import { analyzeGraphHealth } from "./graph.js";
import { loadProfile, writeJson } from "./workspace.js";
import { validateProfileDocument } from "./validation.js";

type Organization = ResumilioProfile["organizations"][number];
type CareerItem = ResumilioProfile["careerItems"][number];
type Resource = ResumilioProfile["resources"][number];
type Connection = ResumilioProfile["connections"][number];

export function revisionOf(profile: ResumilioProfile): string {
  return createHash("sha256").update(JSON.stringify(profile)).digest("hex").slice(0, 16);
}

export async function readProfile(path: string): Promise<{ profile: ResumilioProfile; revision: string }> {
  const profile = await loadProfile(resolve(path));
  return { profile, revision: revisionOf(profile) };
}

async function mutate(path: string, expectedRevision: string | undefined, update: (profile: ResumilioProfile) => void) {
  const profile = await loadProfile(resolve(path));
  const currentRevision = revisionOf(profile);
  if (expectedRevision && expectedRevision !== currentRevision) throw new Error(`Revision conflict. Current revision is ${currentRevision}.`);
  update(profile);
  const validation = validateProfileDocument(profile);
  if (!validation.valid) throw new Error(validation.errors.join("\n"));
  await writeJson(resolve(path), profile);
  return { profileId: profile.profile.id, revision: revisionOf(profile), validation, graphHealth: analyzeGraphHealth(profile) };
}

function upsert<T extends { id: string }>(items: T[], item: T): void {
  const index = items.findIndex((candidate) => candidate.id === item.id);
  if (index === -1) items.push(item); else items[index] = item;
}

export const updateIdentity = (path: string, value: ResumilioProfile["profile"], expectedRevision?: string) => mutate(path, expectedRevision, (profile) => { profile.profile = value; });
export const upsertOrganization = (path: string, value: Organization, expectedRevision?: string) => mutate(path, expectedRevision, (profile) => upsert(profile.organizations, value));
export const upsertCareerItem = (path: string, value: CareerItem, expectedRevision?: string) => mutate(path, expectedRevision, (profile) => upsert(profile.careerItems, value));
export const upsertResource = (path: string, value: Resource, expectedRevision?: string) => mutate(path, expectedRevision, (profile) => upsert(profile.resources, value));
export const upsertConnection = (path: string, value: Connection, expectedRevision?: string) => mutate(path, expectedRevision, (profile) => upsert(profile.connections, value));

export async function validateProfile(path: string) {
  const profile = await loadProfile(resolve(path));
  return { valid: true as const, revision: revisionOf(profile), careerItems: profile.careerItems.length, resources: profile.resources.length, graphHealth: analyzeGraphHealth(profile) };
}
