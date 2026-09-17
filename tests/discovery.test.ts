import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import type { ResumilioProfile } from "../src/profile.js";
import { analyzeConstellationGraph } from "../src/graph-health.js";
import {
  applySignal,
  constellationNeighborhoodSize,
  emptyDiscoveryState,
  mobileConstellationNeighborhoodSize,
  rankConstellationRecommendations,
  rankRecommendations,
  recommendationReason,
  searchClaims,
  traversalSuccessorId,
} from "../src/discovery.js";

const repository = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const profile = JSON.parse(await readFile(resolve(repository, "profiles/daniel.json"), "utf8")) as ResumilioProfile;

test("weighted search supports bilingual prefixes, fuzzy terms, and facets without a model", () => {
  assert.equal(searchClaims(profile, "finaliza")[0].claim.id, "claim-professional-ai-text-completion");
  assert.equal(searchClaims(profile, "hubspat")[0].claim.id, "claim-alphahub-hubspot-specialist");
  assert.deepEqual(searchClaims(profile, "", { lifecycle: "proposal" }).map((item) => item.claim.id), ["claim-masglo-commercial-proposal"]);
  assert.deepEqual(searchClaims(profile, "", { tag: "non-ai" }).map((item) => item.claim.id), ["claim-hubspot-sms-app"]);
});

test("session signals rank deterministically, reward novelty, and grow related branches", () => {
  const base = applySignal(emptyDiscoveryState(), "open", ["hubspot", "automation"], "claim-professional-ai-text-completion");
  const rankedOnce = rankRecommendations(profile, base, "claim-professional-ai-text-completion").map((item) => item.claim.id);
  const rankedTwice = rankRecommendations(profile, base, "claim-professional-ai-text-completion").map((item) => item.claim.id);
  assert.deepEqual(rankedOnce, rankedTwice);
  assert.equal(rankedOnce[0], "claim-masglo-commercial-proposal");
  const grown = applySignal(base, "more-like-this", ["hubspot"], "claim-professional-ai-text-completion");
  const baseHubSpotScore = rankRecommendations(profile, base, "claim-professional-ai-text-completion").find((item) => item.claim.id === "claim-alphahub-hubspot-specialist")!.score;
  const grownHubSpotScore = rankRecommendations(profile, grown, "claim-professional-ai-text-completion").find((item) => item.claim.id === "claim-alphahub-hubspot-specialist")!.score;
  assert.ok(grownHubSpotScore > baseHubSpotScore);
  assert.ok(rankedOnce.indexOf("claim-masglo-commercial-proposal") < rankedOnce.length);
});

test("claim relationships bridge Integration Specialist into Masglo's AI neighborhood", () => {
  const integration = profile.claims.find((claim) => claim.id === "claim-operations-company-integration-specialist")!;
  const masglo = profile.claims.find((claim) => claim.id === "claim-masglo-commercial-proposal")!;
  const afterIntegration = applySignal(emptyDiscoveryState(), "open", integration.tags, integration.id);
  const integrationNeighborhood = rankRecommendations(profile, afterIntegration, integration.id).slice(0, 5).map((item) => item.claim.id);

  assert.equal(integrationNeighborhood[0], masglo.id);

  let noisySession = emptyDiscoveryState();
  for (let index = 0; index < 12; index += 1) {
    noisySession = applySignal(noisySession, "more-like-this", ["hubspot", "automation", "crm"], "claim-alphahub-hubspot-specialist");
  }
  const noisyIntegrationNeighborhood = rankRecommendations(profile, noisySession, integration.id).slice(0, 5).map((item) => item.claim.id);
  assert.equal(noisyIntegrationNeighborhood[0], masglo.id);

  const afterMasglo = applySignal(afterIntegration, "open", masglo.tags, masglo.id);
  const masgloNeighborhood = rankRecommendations(profile, afterMasglo, masglo.id).slice(0, 5).map((item) => item.claim.id);
  assert.deepEqual(new Set(masgloNeighborhood), new Set([
    integration.id,
    "claim-professional-ai-text-completion",
    "claim-google-cloud-big-data-course",
    "claim-how-google-does-machine-learning",
    "claim-mai-full-stack-developer",
  ]));
});

test("topic vectors are session-isolated and recommendation reasons are transparent", () => {
  const first = emptyDiscoveryState();
  const second = emptyDiscoveryState();
  const changed = applySignal(first, "search", ["hubspot", "automation"]);
  assert.deepEqual(second, { topics: {}, openedClaimIds: [], signalCount: 0 });
  assert.notDeepEqual(changed, second);
  assert.equal(recommendationReason(changed, "en"), "Recommended because you explored HubSpot and Automation");
  assert.equal(recommendationReason(changed, "es"), "Recomendado porque exploraste HubSpot y Automation");
});

test("curated order favors recent work while historical roles remain discoverable", () => {
  assert.equal(searchClaims(profile, "PB Collections")[0].claim.id, "claim-pb-collections-regional-distributor");
  assert.equal(searchClaims(profile, "The Loot Gaming")[0].claim.id, "claim-the-loot-gaming-contributor");

  const unpersonalized = rankRecommendations(profile, emptyDiscoveryState()).map((item) => item.claim.id);
  assert.ok(unpersonalized.indexOf("claim-alphahub-hubspot-specialist") < unpersonalized.indexOf("claim-pb-collections-regional-distributor"));
  assert.ok(unpersonalized.indexOf("claim-operations-company-integration-specialist") < unpersonalized.indexOf("claim-hivebound-founder"));

  const contentIntent = applySignal(emptyDiscoveryState(), "search", ["content-marketing", "entrepreneurship"]);
  const contentRecommendations = rankRecommendations(profile, contentIntent).slice(0, 6).map((item) => item.claim.id);
  assert.ok(contentRecommendations.includes("claim-hivebound-founder"));
});

test("every constellation center exposes a stable path inside the mobile recommendation window", () => {
  for (const center of profile.claims) {
    const neighborhood = rankConstellationRecommendations(profile, emptyDiscoveryState(), center.id, constellationNeighborhoodSize)
      .map((item) => item.claim.id);
    assert.equal(neighborhood.length, constellationNeighborhoodSize);
    assert.ok(neighborhood.slice(0, mobileConstellationNeighborhoodSize).includes(traversalSuccessorId(profile, center.id)!));
  }

  for (const start of profile.claims) {
    const reached = new Set([start.id]);
    let currentId = start.id;
    for (let step = 0; step < profile.claims.length - 1; step += 1) {
      currentId = traversalSuccessorId(profile, currentId)!;
      reached.add(currentId);
    }
    assert.equal(reached.size, profile.claims.length);
  }
});

test("an exhausted relevant neighborhood yields an unexplored frontier node", () => {
  const center = profile.claims.find((claim) => claim.id === "claim-masglo-commercial-proposal")!;
  const contextual = applySignal(emptyDiscoveryState(), "open", center.tags, center.id);
  const firstNeighborhood = rankConstellationRecommendations(profile, contextual, center.id, constellationNeighborhoodSize).map((item) => item.claim.id);
  const exhausted = {
    ...contextual,
    openedClaimIds: [center.id, ...firstNeighborhood],
  };
  const nextNeighborhood = rankConstellationRecommendations(profile, exhausted, center.id, constellationNeighborhoodSize).map((item) => item.claim.id);
  const mobileNeighborhood = nextNeighborhood.slice(0, mobileConstellationNeighborhoodSize);

  assert.ok(mobileNeighborhood.some((claimId) => !exhausted.openedClaimIds.includes(claimId)));
  assert.ok(mobileNeighborhood.includes(traversalSuccessorId(profile, center.id)!));
});

test("every mobile neighborhood keeps an unseen escape after its relevant set is exhausted", () => {
  for (const center of profile.claims) {
    const contextual = applySignal(emptyDiscoveryState(), "open", center.tags, center.id);
    const relevantIds = rankConstellationRecommendations(profile, contextual, center.id, constellationNeighborhoodSize)
      .map((item) => item.claim.id);
    const exhausted = { ...contextual, openedClaimIds: [center.id, ...relevantIds] };
    const mobileNeighborhood = rankConstellationRecommendations(profile, exhausted, center.id, constellationNeighborhoodSize)
      .slice(0, mobileConstellationNeighborhoodSize)
      .map((item) => item.claim.id);
    const unseenClaimsRemain = profile.claims.some((claim) => !exhausted.openedClaimIds.includes(claim.id));

    if (unseenClaimsRemain) assert.ok(mobileNeighborhood.some((claimId) => !exhausted.openedClaimIds.includes(claimId)));
  }
});

test("sparse contributor data remains navigable without invented semantic relationships", () => {
  const sparse = structuredClone(profile);
  sparse.claims = sparse.claims.slice(0, 8);
  sparse.relationships = [];
  const health = analyzeConstellationGraph(sparse);

  assert.equal(health.semanticComponentCount, 8);
  assert.equal(health.semanticOrphanClaimIds.length, 8);
  assert.equal(health.minimumReachableClaims, 8);
  assert.equal(health.navigationGuaranteed, true);
  assert.equal(health.traversalStrategy, "deterministic-cycle-with-unexplored-frontier");
});
