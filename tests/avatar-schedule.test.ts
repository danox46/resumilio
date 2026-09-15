import assert from "node:assert/strict";
import test from "node:test";
import {
  ambientAvatarMix,
  pickAmbientAvatarReaction,
  pickGuideCooldownMs,
  shouldStartGuide,
  shouldStartWelcome,
  type AvatarPlayback,
} from "../src/avatar-schedule.js";

test("ambient avatar reactions use the approved 60/20/20 mix", () => {
  assert.deepEqual(ambientAvatarMix, [
    { reaction: "idle", weight: 0.6 },
    { reaction: "waiting", weight: 0.2 },
    { reaction: "smile", weight: 0.2 },
  ]);
});

test("ambient avatar reaction thresholds are deterministic at their boundaries", () => {
  assert.equal(pickAmbientAvatarReaction(0), "idle");
  assert.equal(pickAmbientAvatarReaction(0.599_999), "idle");
  assert.equal(pickAmbientAvatarReaction(0.6), "waiting");
  assert.equal(pickAmbientAvatarReaction(0.799_999), "waiting");
  assert.equal(pickAmbientAvatarReaction(0.8), "smile");
  assert.equal(pickAmbientAvatarReaction(0.999_999), "smile");
});

test("ambient avatar reaction selection rejects values outside Math.random's range", () => {
  assert.throws(() => pickAmbientAvatarReaction(-0.001), RangeError);
  assert.throws(() => pickAmbientAvatarReaction(1), RangeError);
  assert.throws(() => pickAmbientAvatarReaction(Number.NaN), RangeError);
});

test("guide cooldown samples the inclusive five-to-ten-second range", () => {
  assert.equal(pickGuideCooldownMs(0), 5_000);
  assert.equal(pickGuideCooldownMs(0.5), 7_500);
  assert.equal(pickGuideCooldownMs(0.999_999), 10_000);
  assert.throws(() => pickGuideCooldownMs(-0.001), RangeError);
  assert.throws(() => pickGuideCooldownMs(1), RangeError);
});

test("guide policy suppresses active and cooling-down guidance without blocking expiry", () => {
  const activeGuide: AvatarPlayback = { reaction: "guide", sequence: 4, mode: "interactive" };
  const ambient: AvatarPlayback = { reaction: "idle", sequence: 5, mode: "ambient" };
  assert.equal(shouldStartGuide(activeGuide, 10_000, 0), false);
  assert.equal(shouldStartGuide(ambient, 9_999, 10_000), false);
  assert.equal(shouldStartGuide(ambient, 10_000, 10_000), true);
});

test("welcome starts only from the untouched loading state", () => {
  const loading: AvatarPlayback = { reaction: "idle", sequence: 0, mode: "loading" };
  assert.equal(shouldStartWelcome(loading, false), true);
  assert.equal(shouldStartWelcome(loading, true), false);
  assert.equal(shouldStartWelcome({ reaction: "nod", sequence: 1, mode: "interactive" }, false), false);
});
