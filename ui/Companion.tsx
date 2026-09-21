export type CompanionMood = "idle" | "waiting" | "nod" | "smile" | "guide";

export interface CompanionProps {
  mood?: CompanionMood;
  enabled?: boolean;
  className?: string;
}

export function Companion({ mood = "idle", enabled = true, className = "" }: CompanionProps) {
  if (!enabled) return null;
  return (
    <div className={`resumilio-companion resumilio-companion--${mood} ${className}`} aria-hidden="true">
      <svg viewBox="0 0 280 360" role="presentation">
        <path className="companion-tail" d="M78 284c-62 15-61-75-8-68 27 3 33 30 18 47" />
        <path className="companion-body" d="M79 161c-2-70 27-119 78-119 52 0 83 52 79 120l13 105c5 41-31 71-91 71-61 0-98-31-92-73z" />
        <path className="companion-ear" d="M99 70 112 20l32 34M181 53l31-33 3 59" />
        <g className="companion-face">
          <ellipse className="companion-eye" cx="126" cy="123" rx="10" ry="16" />
          <ellipse className="companion-eye" cx="188" cy="123" rx="10" ry="16" />
          <circle className="companion-pupil" cx="129" cy="124" r="4" />
          <circle className="companion-pupil" cx="191" cy="124" r="4" />
          <path className="companion-mouth" d="M143 151q15 14 30 0" />
        </g>
        <g className="companion-arm">
          <path d="M204 191q38 4 60-30" />
          <circle cx="265" cy="160" r="7" />
        </g>
        <circle className="companion-mark" cx="157" cy="225" r="24" />
        <path className="companion-mark-line" d="m143 225 11 10 19-23" />
      </svg>
    </div>
  );
}
