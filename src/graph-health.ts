import { emptyDiscoveryState, mobileConstellationNeighborhoodSize, rankConstellationRecommendations } from "./discovery.js";
import type { ResumilioProfile } from "./profile.js";

export interface ConstellationGraphHealth {
  claimCount: number;
  semanticRelationshipCount: number;
  semanticComponentCount: number;
  semanticOrphanClaimIds: string[];
  traversalStrategy: "deterministic-cycle-with-unexplored-frontier";
  traversalBridgeCount: number;
  minimumReachableClaims: number;
  navigationGuaranteed: boolean;
}

export function analyzeConstellationGraph(profile: ResumilioProfile, neighborhoodSize = mobileConstellationNeighborhoodSize): ConstellationGraphHealth {
  const claimIds = new Set(profile.claims.map((claim) => claim.id));
  const semanticAdjacency = new Map(profile.claims.map((claim) => [claim.id, new Set<string>()]));
  let semanticRelationshipCount = 0;
  for (const relationship of profile.relationships) {
    if (relationship.type !== "related-to") continue;
    if (!claimIds.has(relationship.sourceId) || !claimIds.has(relationship.targetId)) continue;
    semanticAdjacency.get(relationship.sourceId)!.add(relationship.targetId);
    semanticAdjacency.get(relationship.targetId)!.add(relationship.sourceId);
    semanticRelationshipCount += 1;
  }

  const unseenSemanticIds = new Set(claimIds);
  let semanticComponentCount = 0;
  while (unseenSemanticIds.size) {
    semanticComponentCount += 1;
    const start = unseenSemanticIds.values().next().value as string;
    const pending = [start];
    unseenSemanticIds.delete(start);
    while (pending.length) {
      const current = pending.pop()!;
      for (const neighbor of semanticAdjacency.get(current) ?? []) {
        if (!unseenSemanticIds.delete(neighbor)) continue;
        pending.push(neighbor);
      }
    }
  }

  const effectiveAdjacency = new Map(profile.claims.map((claim) => [
    claim.id,
    rankConstellationRecommendations(
      profile,
      emptyDiscoveryState(),
      claim.id,
      Math.min(neighborhoodSize, Math.max(0, profile.claims.length - 1)),
    ).map((item) => item.claim.id),
  ]));
  let minimumReachableClaims = profile.claims.length ? profile.claims.length : 0;
  for (const claim of profile.claims) {
    const reached = new Set([claim.id]);
    const pending = [claim.id];
    while (pending.length) {
      const current = pending.pop()!;
      for (const neighbor of effectiveAdjacency.get(current) ?? []) {
        if (reached.has(neighbor)) continue;
        reached.add(neighbor);
        pending.push(neighbor);
      }
    }
    minimumReachableClaims = Math.min(minimumReachableClaims, reached.size);
  }

  return {
    claimCount: profile.claims.length,
    semanticRelationshipCount,
    semanticComponentCount,
    semanticOrphanClaimIds: [...semanticAdjacency.entries()].filter(([, neighbors]) => neighbors.size === 0).map(([claimId]) => claimId),
    traversalStrategy: "deterministic-cycle-with-unexplored-frontier",
    traversalBridgeCount: profile.claims.length > 1 ? profile.claims.length : 0,
    minimumReachableClaims,
    navigationGuaranteed: minimumReachableClaims === profile.claims.length,
  };
}
