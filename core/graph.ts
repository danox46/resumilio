import type { ResumilioProfile } from "./profile.js";

export interface GraphHealth {
  itemCount: number;
  connectedComponents: string[][];
  connected: boolean;
  mobileVarietyReady: boolean;
  desktopVarietyReady: boolean;
  navigationGuaranteed: boolean;
}

function neighbors(profile: ResumilioProfile, id: string): Set<string> {
  const result = new Set<string>();
  for (const connection of profile.connections) {
    if (connection.sourceId === id) result.add(connection.targetId);
    if (connection.targetId === id) result.add(connection.sourceId);
  }
  return result;
}

export function analyzeGraphHealth(profile: ResumilioProfile): GraphHealth {
  const unseen = new Set(profile.careerItems.map((item) => item.id));
  const components: string[][] = [];
  while (unseen.size) {
    const first = unseen.values().next().value as string;
    const queue = [first];
    const component: string[] = [];
    unseen.delete(first);
    while (queue.length) {
      const id = queue.shift()!;
      component.push(id);
      for (const candidate of neighbors(profile, id)) if (unseen.delete(candidate)) queue.push(candidate);
    }
    components.push(component.sort());
  }
  const count = profile.careerItems.length;
  return {
    itemCount: count,
    connectedComponents: components,
    connected: components.length <= 1,
    mobileVarietyReady: count >= 5,
    desktopVarietyReady: count >= 6,
    navigationGuaranteed: count > 0,
  };
}

function affinity(profile: ResumilioProfile, centerId: string, candidateId: string, visited: Set<string>): number {
  const center = profile.careerItems.find((item) => item.id === centerId)!;
  const candidate = profile.careerItems.find((item) => item.id === candidateId)!;
  let score = 0;
  if (neighbors(profile, centerId).has(candidateId)) score += 50;
  if (center.organizationId && center.organizationId === candidate.organizationId) score += 16;
  score += candidate.tags.filter((tag) => center.tags.includes(tag)).length * 7;
  if (!visited.has(candidateId)) score += 22;
  if (candidate.kind !== center.kind) score += 5;
  return score;
}

export function recommendations(profile: ResumilioProfile, centerId: string, limit: number, visitedIds: string[] = []): string[] {
  const visited = new Set(visitedIds);
  return profile.careerItems
    .filter((item) => item.id !== centerId)
    .map((item) => ({ id: item.id, score: affinity(profile, centerId, item.id, visited) }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, Math.max(1, limit))
    .map((entry) => entry.id);
}

export function findPath(profile: ResumilioProfile, startId: string, targetId: string, limit: number): string[] {
  if (startId === targetId) return [startId];
  const queue: string[][] = [[startId]];
  const seen = new Set([startId]);
  while (queue.length) {
    const path = queue.shift()!;
    const current = path.at(-1)!;
    const next = recommendations(profile, current, limit, [...seen]);
    for (const id of next) {
      if (id === targetId) return [...path, id];
      if (!seen.has(id)) { seen.add(id); queue.push([...path, id]); }
    }
  }
  return [];
}
