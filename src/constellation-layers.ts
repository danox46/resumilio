import { applySignal, rankConstellationRecommendations, type DiscoveryState } from "./discovery.js";
import type { ResumilioProfile } from "./profile.js";

export type ConstellationPoint = readonly [number, number];
export type ConstellationDrift = readonly [number, number];

export interface ConstellationSlot {
  index: number;
  point: ConstellationPoint;
  midPoint: ConstellationPoint;
  className: string;
}

export interface ReserveNodePlan {
  key: string;
  ownerId: string;
  claimId: string;
  destinationSlot: number;
  origin: ConstellationPoint;
  destination: ConstellationPoint;
  drift: ConstellationDrift;
  scale: number;
}

export interface SuccessorLayerPlan {
  targetId: string;
  targetSlot: number;
  nextDiscovery: DiscoveryState;
  nextNeighborhoodIds: string[];
  nextSlotByClaimId: Record<string, number>;
  nextDriftByClaimId: Record<string, ConstellationDrift>;
  sharedIds: string[];
  incomingIds: string[];
  outgoingIds: string[];
  previousCenterRetained: boolean;
  reserveNodes: ReserveNodePlan[];
  retreatPointByClaimId: Record<string, ConstellationPoint>;
}

export interface LayerPlan {
  selectedId: string;
  neighborhoodIds: string[];
  slotByClaimId: Record<string, number>;
  driftByClaimId: Record<string, ConstellationDrift>;
  successors: SuccessorLayerPlan[];
  reserveCount: number;
}

export const constellationFocus: ConstellationPoint = [60, 54];
export const constellationSlots: readonly ConstellationSlot[] = [
  { index: 0, point: [54, 13], midPoint: [58, 21], className: "north" },
  { index: 1, point: [30, 34], midPoint: [20, 38], className: "west" },
  { index: 2, point: [83, 31], midPoint: [92, 35], className: "east" },
  { index: 3, point: [39, 79], midPoint: [22, 81], className: "south-west" },
  { index: 4, point: [79, 77], midPoint: [91, 79], className: "south-east" },
] as const;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function hashUnit(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

export function stableNodeDrift(selectedId: string, claimId: string): ConstellationDrift {
  const angle = hashUnit(`${selectedId}:${claimId}:angle`) * Math.PI * 2;
  const magnitude = 8 + hashUnit(`${selectedId}:${claimId}:distance`) * 16;
  return [Math.cos(angle) * magnitude, Math.sin(angle) * magnitude];
}

function reserveOrigin(ownerId: string, claimId: string, slotIndex: number, incomingIndex: number): ConstellationPoint {
  const destination = constellationSlots[slotIndex].point;
  const vectorX = destination[0] - constellationFocus[0];
  const vectorY = destination[1] - constellationFocus[1];
  const length = Math.max(1, Math.hypot(vectorX, vectorY));
  const depth = 1.42 + hashUnit(`${ownerId}:${claimId}:depth`) * .32 + incomingIndex * .035;
  const tangent = (hashUnit(`${ownerId}:${claimId}:tangent`) - .5) * 11;
  return [
    clamp(constellationFocus[0] + vectorX * depth + (-vectorY / length) * tangent, 3, 97),
    clamp(constellationFocus[1] + vectorY * depth + (vectorX / length) * tangent, 4, 96),
  ];
}

function normalizedSlots(neighborhoodIds: string[], requested: Record<string, number>) {
  const result: Record<string, number> = {};
  const available = constellationSlots.map((slot) => slot.index);
  for (const [fallback, claimId] of neighborhoodIds.entries()) {
    const requestedSlot = requested[claimId];
    const slot = available.includes(requestedSlot) ? requestedSlot : available.includes(fallback) ? fallback : available[0];
    result[claimId] = slot;
    available.splice(available.indexOf(slot), 1);
  }
  return result;
}

export function buildSuccessorLayer(
  profile: ResumilioProfile,
  discoveryBeforeOpen: DiscoveryState,
  selectedId: string,
  neighborhoodIds: string[],
  slotByClaimId: Record<string, number>,
  targetId: string,
): SuccessorLayerPlan {
  const target = profile.claims.find((claim) => claim.id === targetId);
  if (!target) throw new Error(`Cannot prepare an unknown constellation target: ${targetId}`);

  const currentSlots = normalizedSlots(neighborhoodIds, slotByClaimId);
  const targetSlot = currentSlots[targetId] ?? 0;
  const nextDiscovery = applySignal(discoveryBeforeOpen, "open", target.tags, target.id);
  const contextualState = applySignal(nextDiscovery, "open", target.tags, target.id);
  const nextNeighborhoodIds = rankConstellationRecommendations(profile, contextualState, target.id, constellationSlots.length)
    .map((result) => result.claim.id);
  const currentIds = new Set(neighborhoodIds);
  const nextIds = new Set(nextNeighborhoodIds);
  const sharedIds = nextNeighborhoodIds.filter((claimId) => currentIds.has(claimId));
  const incomingIds = nextNeighborhoodIds.filter((claimId) => !currentIds.has(claimId));
  const outgoingIds = neighborhoodIds.filter((claimId) => claimId !== targetId && !nextIds.has(claimId));

  const nextSlotByClaimId: Record<string, number> = {};
  for (const claimId of sharedIds) nextSlotByClaimId[claimId] = currentSlots[claimId];
  const occupied = new Set(Object.values(nextSlotByClaimId));
  const available = constellationSlots.map((slot) => slot.index).filter((slot) => !occupied.has(slot));

  if (incomingIds.includes(selectedId) && available.includes(targetSlot)) {
    nextSlotByClaimId[selectedId] = targetSlot;
    available.splice(available.indexOf(targetSlot), 1);
  }
  for (const claimId of incomingIds) {
    if (nextSlotByClaimId[claimId] !== undefined) continue;
    const slot = available.shift();
    if (slot === undefined) throw new Error(`No constellation slot remains for ${claimId}`);
    nextSlotByClaimId[claimId] = slot;
  }

  const nextDriftByClaimId = Object.fromEntries(nextNeighborhoodIds.map((claimId) => [claimId, stableNodeDrift(targetId, claimId)]));
  const reserveNodes = incomingIds.map((claimId, incomingIndex) => {
    const destinationSlot = nextSlotByClaimId[claimId];
    return {
      key: `${targetId}:${claimId}`,
      ownerId: targetId,
      claimId,
      destinationSlot,
      origin: reserveOrigin(targetId, claimId, destinationSlot, incomingIndex),
      destination: constellationSlots[destinationSlot].point,
      drift: nextDriftByClaimId[claimId],
      scale: .5 + hashUnit(`${targetId}:${claimId}:scale`) * .22,
    };
  });
  const retreatPointByClaimId = Object.fromEntries(outgoingIds.map((claimId, outgoingIndex) => {
    const slot = currentSlots[claimId];
    return [claimId, reserveOrigin(targetId, claimId, slot, outgoingIndex)];
  }));

  return {
    targetId,
    targetSlot,
    nextDiscovery,
    nextNeighborhoodIds,
    nextSlotByClaimId,
    nextDriftByClaimId,
    sharedIds,
    incomingIds,
    outgoingIds,
    previousCenterRetained: incomingIds.includes(selectedId),
    reserveNodes,
    retreatPointByClaimId,
  };
}

export function buildLayerPlan(
  profile: ResumilioProfile,
  discovery: DiscoveryState,
  selectedId: string,
  neighborhoodIds: string[],
  requestedSlots: Record<string, number> = {},
): LayerPlan {
  const slotByClaimId = normalizedSlots(neighborhoodIds, requestedSlots);
  const driftByClaimId = Object.fromEntries(neighborhoodIds.map((claimId) => [claimId, stableNodeDrift(selectedId, claimId)]));
  const successors = neighborhoodIds.map((targetId) => buildSuccessorLayer(
    profile,
    discovery,
    selectedId,
    neighborhoodIds,
    slotByClaimId,
    targetId,
  ));
  return {
    selectedId,
    neighborhoodIds,
    slotByClaimId,
    driftByClaimId,
    successors,
    reserveCount: successors.reduce((total, layer) => total + layer.reserveNodes.length, 0),
  };
}
