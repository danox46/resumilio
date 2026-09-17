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
  nextMobileSlotByClaimId: Record<string, number>;
  nextDriftByClaimId: Record<string, ConstellationDrift>;
  sharedIds: string[];
  incomingIds: string[];
  outgoingIds: string[];
  previousCenterRetained: boolean;
  reserveNodes: ReserveNodePlan[];
  mobileReserveNodes: ReserveNodePlan[];
  retreatPointByClaimId: Record<string, ConstellationPoint>;
}

export interface LayerPlan {
  selectedId: string;
  neighborhoodIds: string[];
  slotByClaimId: Record<string, number>;
  mobileSlotByClaimId: Record<string, number>;
  driftByClaimId: Record<string, ConstellationDrift>;
  successors: SuccessorLayerPlan[];
  reserveCount: number;
}

export const constellationFocus: ConstellationPoint = [60, 54];
export const constellationSlots: readonly ConstellationSlot[] = [
  { index: 0, point: [54, 13], midPoint: [58, 21], className: "north" },
  { index: 1, point: [31.5, 34], midPoint: [20, 38], className: "west" },
  { index: 2, point: [83, 31], midPoint: [92, 35], className: "east" },
  { index: 3, point: [39, 79], midPoint: [22, 81], className: "south-west" },
  { index: 4, point: [79, 77], midPoint: [91, 79], className: "south-east" },
] as const;

export const mobileConstellationSlots: readonly ConstellationSlot[] = [
  { index: 0, point: [84, 29], midPoint: [93, 42], className: "mobile-north-east" },
  { index: 1, point: [15, 67], midPoint: [15, 67], className: "mobile-south-west" },
  { index: 2, point: [63, 81], midPoint: [89, 72], className: "mobile-south-east" },
] as const;

const mobileReserveOriginPools: readonly (readonly ConstellationPoint[])[] = [
  [[96, 13], [93, 42], [88, 8]],
  [[5, 52], [12, 92], [18, 27]],
  [[89, 72], [58, 91]],
];
export const mobileReservePool: readonly ConstellationPoint[] = mobileReserveOriginPools.flat();

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

function mobileReserveOrigin(ownerId: string, claimId: string, slotIndex: number): ConstellationPoint {
  const pool = mobileReserveOriginPools[slotIndex] ?? mobileReserveOriginPools[0];
  return pool[Math.floor(hashUnit(`${ownerId}:${claimId}:mobile-origin`) * pool.length) % pool.length];
}

function normalizedSlots(neighborhoodIds: string[], requested: Record<string, number>) {
  return normalizedSlotSet(neighborhoodIds, requested, constellationSlots);
}

function normalizedSlotSet(neighborhoodIds: string[], requested: Record<string, number>, slots: readonly ConstellationSlot[]) {
  const result: Record<string, number> = {};
  const available = slots.map((slot) => slot.index);
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
  mobileSlotByClaimId: Record<string, number> = {},
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

  const currentMobileIds = neighborhoodIds.slice(0, mobileConstellationSlots.length);
  const nextMobileIds = nextNeighborhoodIds.slice(0, mobileConstellationSlots.length);
  const currentMobileSlots = normalizedSlotSet(currentMobileIds, mobileSlotByClaimId, mobileConstellationSlots);
  const targetMobileSlot = currentMobileSlots[targetId] ?? 0;
  const currentMobileSet = new Set(currentMobileIds);
  const mobileSharedIds = nextMobileIds.filter((claimId) => currentMobileSet.has(claimId));
  const mobileIncomingIds = nextMobileIds.filter((claimId) => !currentMobileSet.has(claimId));
  const nextMobileSlotByClaimId: Record<string, number> = {};
  for (const claimId of mobileSharedIds) nextMobileSlotByClaimId[claimId] = currentMobileSlots[claimId];
  const availableMobileSlots = mobileConstellationSlots.map((slot) => slot.index)
    .filter((slot) => !new Set(Object.values(nextMobileSlotByClaimId)).has(slot));
  if (mobileIncomingIds.includes(selectedId) && availableMobileSlots.includes(targetMobileSlot)) {
    nextMobileSlotByClaimId[selectedId] = targetMobileSlot;
    availableMobileSlots.splice(availableMobileSlots.indexOf(targetMobileSlot), 1);
  }
  for (const claimId of mobileIncomingIds) {
    if (nextMobileSlotByClaimId[claimId] !== undefined) continue;
    const slot = availableMobileSlots.shift();
    if (slot === undefined) throw new Error(`No mobile constellation slot remains for ${claimId}`);
    nextMobileSlotByClaimId[claimId] = slot;
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
  const mobileReserveNodes = mobileIncomingIds.map((claimId) => {
    const destinationSlot = nextMobileSlotByClaimId[claimId];
    return {
      key: `${targetId}:${claimId}:mobile`,
      ownerId: targetId,
      claimId,
      destinationSlot,
      origin: mobileReserveOrigin(targetId, claimId, destinationSlot),
      destination: mobileConstellationSlots[destinationSlot].point,
      drift: [0, 0] as ConstellationDrift,
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
    nextMobileSlotByClaimId,
    nextDriftByClaimId,
    sharedIds,
    incomingIds,
    outgoingIds,
    previousCenterRetained: incomingIds.includes(selectedId),
    reserveNodes,
    mobileReserveNodes,
    retreatPointByClaimId,
  };
}

export function buildLayerPlan(
  profile: ResumilioProfile,
  discovery: DiscoveryState,
  selectedId: string,
  neighborhoodIds: string[],
  requestedSlots: Record<string, number> = {},
  requestedMobileSlots: Record<string, number> = {},
): LayerPlan {
  const slotByClaimId = normalizedSlots(neighborhoodIds, requestedSlots);
  const mobileSlotByClaimId = normalizedSlotSet(
    neighborhoodIds.slice(0, mobileConstellationSlots.length),
    requestedMobileSlots,
    mobileConstellationSlots,
  );
  const driftByClaimId = Object.fromEntries(neighborhoodIds.map((claimId) => [claimId, stableNodeDrift(selectedId, claimId)]));
  const successors = neighborhoodIds.map((targetId) => buildSuccessorLayer(
    profile,
    discovery,
    selectedId,
    neighborhoodIds,
    slotByClaimId,
    targetId,
    mobileSlotByClaimId,
  ));
  return {
    selectedId,
    neighborhoodIds,
    slotByClaimId,
    mobileSlotByClaimId,
    driftByClaimId,
    successors,
    reserveCount: successors.reduce((total, layer) => total + layer.reserveNodes.length, 0),
  };
}
