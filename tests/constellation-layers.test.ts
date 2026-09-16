import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { ResumilioProfile } from "../src/profile.js";
import { applySignal, emptyDiscoveryState, mobileConstellationNeighborhoodSize, rankConstellationRecommendations, traversalSuccessorId } from "../src/discovery.js";
import { buildLayerPlan, buildSuccessorLayer, constellationSlots } from "../src/constellation-layers.js";

const profile = JSON.parse(await readFile("profiles/daniel.json", "utf8")) as ResumilioProfile;

function neighborhood(selectedId: string) {
  const selected = profile.claims.find((claim) => claim.id === selectedId)!;
  const discovery = applySignal(emptyDiscoveryState(), "open", selected.tags, selected.id);
  return {
    discovery,
    ids: rankConstellationRecommendations(profile, applySignal(discovery, "open", selected.tags, selected.id), selected.id, constellationSlots.length)
      .map((result) => result.claim.id),
  };
}

test("each visible node owns a deterministic one-step successor layer", () => {
  const selectedId = "claim-alphahub-hubspot-specialist";
  const current = neighborhood(selectedId);
  const first = buildLayerPlan(profile, current.discovery, selectedId, current.ids);
  const second = buildLayerPlan(profile, current.discovery, selectedId, current.ids);

  assert.deepEqual(first, second);
  assert.equal(first.successors.length, 5);
  assert.equal(first.reserveCount, first.successors.reduce((total, layer) => total + 5 - layer.sharedIds.length, 0));
  assert.ok(first.successors.every((layer) => layer.reserveNodes.length === 5 - layer.sharedIds.length));
  assert.ok(first.successors.every((layer) => layer.nextNeighborhoodIds
    .slice(0, mobileConstellationNeighborhoodSize)
    .includes(traversalSuccessorId(profile, layer.targetId)!)));
});

test("reserve instances stay separate when branches reserve the same record", () => {
  const selectedId = "claim-alphahub-hubspot-specialist";
  const current = neighborhood(selectedId);
  const plan = buildLayerPlan(profile, current.discovery, selectedId, current.ids);
  const previousCenterReservations = plan.successors.flatMap((layer) => layer.reserveNodes).filter((node) => node.claimId === selectedId);

  assert.equal(previousCenterReservations.length, 5);
  assert.equal(new Set(previousCenterReservations.map((node) => node.key)).size, 5);
  assert.equal(new Set(previousCenterReservations.map((node) => node.ownerId)).size, 5);
});

test("shared nodes retain slots while the previous center takes the selected target slot", () => {
  const selectedId = "claim-alphahub-hubspot-specialist";
  const current = neighborhood(selectedId);
  const plan = buildLayerPlan(profile, current.discovery, selectedId, current.ids);

  for (const layer of plan.successors) {
    for (const claimId of layer.sharedIds) assert.equal(layer.nextSlotByClaimId[claimId], plan.slotByClaimId[claimId]);
    assert.equal(layer.previousCenterRetained, true);
    assert.equal(layer.nextSlotByClaimId[selectedId], layer.targetSlot);
  }
});

test("the profile exercises successor layers with zero through four shared nodes", () => {
  const overlapCounts = new Set<number>();
  for (const selected of profile.claims) {
    const current = neighborhood(selected.id);
    for (const targetId of current.ids) {
      overlapCounts.add(buildSuccessorLayer(profile, current.discovery, selected.id, current.ids, {}, targetId).sharedIds.length);
    }
  }
  assert.deepEqual([...overlapCounts].sort((left, right) => left - right), [0, 1, 2, 3, 4]);
});

test("reserve and retreat coordinates remain within the constellation stage", () => {
  const selectedId = "claim-teleperformance-support-engineer";
  const current = neighborhood(selectedId);
  const plan = buildLayerPlan(profile, current.discovery, selectedId, current.ids);
  const points = plan.successors.flatMap((layer) => [
    ...layer.reserveNodes.map((node) => node.origin),
    ...Object.values(layer.retreatPointByClaimId),
  ]);

  assert.ok(points.length > 0);
  assert.ok(points.every(([x, y]) => x >= 3 && x <= 97 && y >= 4 && y <= 96));
});
