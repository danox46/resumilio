import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { CompanionPlayback } from "./companion-schedule.js";

export type { CompanionMood, CompanionPlayback, CompanionPlaybackMode } from "./companion-schedule.js";

export interface CompanionProps {
  playback?: CompanionPlayback;
  enabled?: boolean;
  className?: string;
  assetBasePath?: string;
}

const framesPerSecond = 14;
const spriteSheets = {
  idle: { frames: 64, columns: 8, rows: 8 },
  smile: { frames: 32, columns: 8, rows: 4 },
} as const;

function useSpriteFrame(playback: CompanionPlayback, enabled: boolean) {
  const spriteName = playback.mood === "smile" ? "smile" : "idle";
  const sprite = spriteSheets[spriteName];
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    setFrame(0);
    if (!enabled) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches || playback.mood === "guide") return;
    const startedAt = performance.now();
    const timer = window.setInterval(() => {
      const elapsedFrame = Math.floor((performance.now() - startedAt) / (1000 / framesPerSecond));
      setFrame(playback.mood === "smile" ? Math.min(sprite.frames - 1, elapsedFrame) : elapsedFrame % sprite.frames);
    }, 1000 / framesPerSecond);
    return () => window.clearInterval(timer);
  }, [enabled, playback.mood, playback.sequence, sprite.frames]);

  return useMemo(() => ({ spriteName, sprite, frame }), [frame, sprite, spriteName]);
}

export function Companion({
  playback = { mood: "idle", sequence: 0, mode: "loading" },
  enabled = true,
  className = "",
  assetBasePath = "/images/resumilio-cat",
}: CompanionProps) {
  const { spriteName, sprite, frame } = useSpriteFrame(playback, enabled);
  if (!enabled) return null;
  const column = frame % sprite.columns;
  const row = Math.floor(frame / sprite.columns);
  const spriteStyle = {
    "--sprite-width": `${sprite.columns * 100}%`,
    "--sprite-height": `${sprite.rows * 100}%`,
    "--sprite-x": `${(column / (sprite.columns - 1)) * 100}%`,
    "--sprite-y": `${(row / (sprite.rows - 1)) * 100}%`,
    backgroundImage: `url(${assetBasePath}-${spriteName}-sheet.png?v=states-v1)`,
  } as CSSProperties;

  return (
    <div
      className={`resumilio-companion resumilio-companion--${playback.mood} ${className}`}
      data-companion-state={playback.mood}
      data-companion-mode={playback.mode}
      data-companion-sequence={playback.sequence}
      aria-hidden="true"
    >
      <span className="companion-backdrop"><i/><i/></span>
      <span className={`companion-sprite-window companion-sprite-window--${spriteName}`} key={`${playback.sequence}-${spriteName}`}>
        <span className="companion-sprite" data-sprite-frame={frame} style={spriteStyle}/>
      </span>
      <img className="companion-pose companion-pose--idle" src={`${assetBasePath}-idle.png?v=states-v1`} alt="" width="1024" height="1024" loading="eager" decoding="async" draggable="false" />
      <img className="companion-pose companion-pose--smile" src={`${assetBasePath}-smile.png?v=states-v1`} alt="" width="1024" height="1024" loading="eager" decoding="async" draggable="false" />
      <img className="companion-pose companion-pose--guide-wide" src={`${assetBasePath}-guide-wide.png?v=states-v1`} alt="" width="1024" height="1024" loading="eager" decoding="async" draggable="false" />
      <img className="companion-pose companion-pose--guide-mobile" src={`${assetBasePath}-guide-mobile.png?v=states-v1`} alt="" width="1024" height="1024" loading="eager" decoding="async" draggable="false" />
    </div>
  );
}
