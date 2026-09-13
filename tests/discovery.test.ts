import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import type { ResumilioProfile } from "../src/profile.js";
import { applySignal, emptyDiscoveryState, rankRecommendations, recommendationReason, searchClaims } from "../src/discovery.js";

const repository = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const profile = JSON.parse(await readFile(resolve(repository, "profiles/daniel.json"), "utf8")) as ResumilioProfile;

test("weighted search supports bilingual prefixes, fuzzy terms, and facets without a model", () => {
  assert.equal(searchClaims(profile, "finaliza")[0].claim.id, "claim-professional-ai-text-completion");
  assert.equal(searchClaims(profile, "hubspat")[0].claim.id, "claim-hubspot-sms-app");
  assert.deepEqual(searchClaims(profile, "", { lifecycle: "proposal" }).map((item) => item.claim.id), ["claim-masglo-commercial-proposal"]);
  assert.deepEqual(searchClaims(profile, "", { tag: "non-ai" }).map((item) => item.claim.id), ["claim-hubspot-sms-app"]);
});

test("session signals rank deterministically, reward novelty, and grow related branches", () => {
  const base = applySignal(emptyDiscoveryState(), "open", ["hubspot", "automation"], "claim-professional-ai-text-completion");
  const rankedOnce = rankRecommendations(profile, base, "claim-professional-ai-text-completion").map((item) => item.claim.id);
  const rankedTwice = rankRecommendations(profile, base, "claim-professional-ai-text-completion").map((item) => item.claim.id);
  assert.deepEqual(rankedOnce, rankedTwice);
  assert.equal(rankedOnce[0], "claim-hubspot-sms-app");
  const grown = applySignal(base, "more-like-this", ["hubspot"], "claim-professional-ai-text-completion");
  assert.ok(rankRecommendations(profile, grown, "claim-professional-ai-text-completion")[0].score > rankRecommendations(profile, base, "claim-professional-ai-text-completion")[0].score);
  assert.ok(rankedOnce.indexOf("claim-masglo-commercial-proposal") < rankedOnce.length);
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
