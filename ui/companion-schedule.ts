export type AmbientCompanionMood = "idle" | "waiting" | "smile";
export type CompanionMood = AmbientCompanionMood | "nod" | "guide";
export type CompanionPlaybackMode = "loading" | "welcome" | "ambient" | "interactive";

export interface CompanionPlayback {
  mood: CompanionMood;
  sequence: number;
  mode: CompanionPlaybackMode;
}

export const ambientCompanionMix: ReadonlyArray<{ mood: AmbientCompanionMood; weight: number }> = [
  { mood: "idle", weight: 0.6 },
  { mood: "waiting", weight: 0.2 },
  { mood: "smile", weight: 0.2 },
];

export const companionReactionDurationMs: Record<CompanionMood, number> = {
  idle: 6_900,
  waiting: 5_800,
  nod: 5_800,
  smile: 5_800,
  guide: 5_800,
};

export function pickAmbientCompanionMood(randomValue = Math.random()): AmbientCompanionMood {
  if (!Number.isFinite(randomValue) || randomValue < 0 || randomValue >= 1) {
    throw new RangeError("Companion random value must be between 0 (inclusive) and 1 (exclusive).");
  }
  let threshold = 0;
  for (const entry of ambientCompanionMix) {
    threshold += entry.weight;
    if (randomValue < threshold) return entry.mood;
  }
  return ambientCompanionMix[ambientCompanionMix.length - 1].mood;
}

export function pickGuideCooldownMs(randomValue = Math.random()) {
  if (!Number.isFinite(randomValue) || randomValue < 0 || randomValue >= 1) {
    throw new RangeError("Guide cooldown random value must be between 0 (inclusive) and 1 (exclusive).");
  }
  return Math.round(5_000 + randomValue * 5_000);
}

export function shouldStartGuide(playback: CompanionPlayback, now: number, cooldownUntil: number) {
  return !(playback.mode === "interactive" && playback.mood === "guide") && now >= cooldownUntil;
}

export function shouldStartWelcome(playback: CompanionPlayback, alreadyHandled: boolean) {
  return !alreadyHandled && playback.mode === "loading";
}
