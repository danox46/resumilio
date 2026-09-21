import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { analyzeGraphHealth, findPath, recommendations } from "../core/graph.js";
import type { ResumilioProfile } from "../core/profile.js";

const profile = JSON.parse(await readFile("profiles/demo.json", "utf8")) as ResumilioProfile;

test("demo graph is connected and ready for four and five-node views", () => {
  const health = analyzeGraphHealth(profile);
  assert.equal(health.connected, true);
  assert.equal(health.mobileVarietyReady, true);
  assert.equal(health.desktopVarietyReady, true);
});

test("recommendations are deterministic and prioritize unvisited variety", () => {
  const first = recommendations(profile, profile.careerItems[0].id, 4, []);
  const second = recommendations(profile, profile.careerItems[0].id, 4, []);
  assert.deepEqual(first, second);
  assert.equal(new Set(first).size, 4);
});

test("every career item remains reachable in mobile and desktop recommendation modes", () => {
  for (const source of profile.careerItems) for (const target of profile.careerItems) {
    assert.ok(findPath(profile, source.id, target.id, 4).length, `${target.id} should be reachable from ${source.id} on mobile`);
    assert.ok(findPath(profile, source.id, target.id, 5).length, `${target.id} should be reachable from ${source.id} on desktop`);
  }
});
