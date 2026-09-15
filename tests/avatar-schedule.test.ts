import assert from "node:assert/strict";
import test from "node:test";
import { ambientAvatarMix, pickAmbientAvatarReaction } from "../src/avatar-schedule.js";

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
