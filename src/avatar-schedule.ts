export type AmbientAvatarReaction = "idle" | "waiting" | "smile";
export type AvatarReaction = AmbientAvatarReaction | "nod" | "guide";
export type AvatarPlaybackMode = "loading" | "welcome" | "ambient" | "interactive";
export type AvatarLayout = "wide" | "stacked";

export interface AvatarPlayback {
  reaction: AvatarReaction;
  sequence: number;
  mode: AvatarPlaybackMode;
}

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

export function pickGuideCooldownMs(randomValue = Math.random()): number {
  if (!Number.isFinite(randomValue) || randomValue < 0 || randomValue >= 1) {
    throw new RangeError("Guide cooldown random value must be between 0 (inclusive) and 1 (exclusive).");
  }
  return Math.round(5_000 + randomValue * 5_000);
}

export function shouldStartGuide(playback: AvatarPlayback, now: number, cooldownUntil: number): boolean {
  return !(playback.mode === "interactive" && playback.reaction === "guide") && now >= cooldownUntil;
}

export function shouldStartWelcome(playback: AvatarPlayback, alreadyHandled: boolean): boolean {
  return !alreadyHandled && playback.mode === "loading";
}
