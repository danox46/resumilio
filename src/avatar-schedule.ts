export type AmbientAvatarReaction = "idle" | "waiting" | "smile";

export const ambientAvatarMix: ReadonlyArray<{ reaction: AmbientAvatarReaction; weight: number }> = [
  { reaction: "idle", weight: 0.6 },
  { reaction: "waiting", weight: 0.2 },
  { reaction: "smile", weight: 0.2 },
];

export function pickAmbientAvatarReaction(randomValue = Math.random()): AmbientAvatarReaction {
  if (!Number.isFinite(randomValue) || randomValue < 0 || randomValue >= 1) {
    throw new RangeError("Avatar random value must be between 0 (inclusive) and 1 (exclusive).");
  }

  let threshold = 0;
  for (const entry of ambientAvatarMix) {
    threshold += entry.weight;
    if (randomValue < threshold) return entry.reaction;
  }

  return ambientAvatarMix[ambientAvatarMix.length - 1].reaction;
}
