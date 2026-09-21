export type CompanionMood = "idle" | "waiting" | "nod" | "smile" | "guide";

export interface CompanionProps {
  mood?: CompanionMood;
  enabled?: boolean;
  className?: string;
  spriteBasePath?: string;
}

const spriteLayers = ["idle", "waiting", "nod", "smile", "guide-wide", "guide-mobile"] as const;

export function Companion({
  mood = "idle",
  enabled = true,
  className = "",
  spriteBasePath = "/images/resumilio-companion",
}: CompanionProps) {
  if (!enabled) return null;
  return (
    <div className={`resumilio-companion resumilio-companion--${mood} ${className}`} aria-hidden="true">
      {spriteLayers.map((layer) => (
        <img
          className={`companion-sprite companion-sprite--${layer}`}
          src={`${spriteBasePath}-${layer}.png`}
          alt=""
          width="1024"
          height="1024"
          loading="eager"
          decoding="async"
          draggable="false"
          key={layer}
        />
      ))}
    </div>
  );
}
