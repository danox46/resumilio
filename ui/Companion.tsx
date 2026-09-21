export type CompanionMood = "idle" | "waiting" | "nod" | "smile" | "guide";

export interface CompanionProps {
  mood?: CompanionMood;
  enabled?: boolean;
  className?: string;
  spriteSrc?: string;
}

export function Companion({
  mood = "idle",
  enabled = true,
  className = "",
  spriteSrc = "/images/resumilio-companion-sprite.png",
}: CompanionProps) {
  if (!enabled) return null;
  return (
    <div className={`resumilio-companion resumilio-companion--${mood} ${className}`} aria-hidden="true">
      <img
        className="companion-sprite"
        src={spriteSrc}
        alt=""
        width="1024"
        height="1536"
        decoding="async"
        draggable="false"
      />
    </div>
  );
}
