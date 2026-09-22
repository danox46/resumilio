import assert from "node:assert/strict";
import test from "node:test";

import {
  ambientCompanionMix,
  pickAmbientCompanionMood,
  pickGuideCooldownMs,
  shouldStartGuide,
  shouldStartWelcome,
  type CompanionPlayback,
} from "../ui/companion-schedule.js";

test("companion ambient playback mirrors the 60/20/20 avatar mix", () => {
  assert.deepEqual(ambientCompanionMix, [
    { mood: "idle", weight: 0.6 },
    { mood: "waiting", weight: 0.2 },
    { mood: "smile", weight: 0.2 },
  ]);
  assert.equal(pickAmbientCompanionMood(0), "idle");
  assert.equal(pickAmbientCompanionMood(0.5999), "idle");
  assert.equal(pickAmbientCompanionMood(0.6), "waiting");
  assert.equal(pickAmbientCompanionMood(0.8), "smile");
});

test("guide cooldown and welcome gate match the interactive avatar contract", () => {
  const idle: CompanionPlayback = { mood: "idle", sequence: 0, mode: "loading" };
  const guide: CompanionPlayback = { mood: "guide", sequence: 2, mode: "interactive" };
  assert.equal(shouldStartWelcome(idle, false), true);
  assert.equal(shouldStartWelcome(idle, true), false);
  assert.equal(shouldStartGuide(idle, 10_000, 9_999), true);
  assert.equal(shouldStartGuide(guide, 10_000, 0), false);
  assert.equal(pickGuideCooldownMs(0), 5_000);
  assert.equal(pickGuideCooldownMs(0.9999), 10_000);
});
