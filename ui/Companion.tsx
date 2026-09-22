export type CompanionMood = "idle" | "waiting" | "nod" | "smile" | "guide";

export interface CompanionProps {
  mood?: CompanionMood;
  enabled?: boolean;
  className?: string;
  assetBasePath?: string;
}

const poseLayers = ["idle", "blink", "smile", "guide-wide", "guide-mobile"] as const;

export function Companion({
  mood = "idle",
  enabled = true,
  className = "",
  assetBasePath = "/images/resumilio-cat",
}: CompanionProps) {
  if (!enabled) return null;
  return (
    <div className={`resumilio-companion resumilio-companion--${mood} ${className}`} aria-hidden="true">
      {poseLayers.map((layer) => (
        <img
          className={`companion-pose companion-pose--${layer}`}
          src={`${assetBasePath}-${layer}.png`}
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
