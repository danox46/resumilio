import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { applySignal, emptyDiscoveryState, normalizeTerm, rankRecommendations, searchClaims, type DiscoveryState } from "../discovery.js";
import type { Locale, ResumilioProfile } from "../profile.js";
import { marketClaimSummary, marketEvidenceTitle, marketLabel } from "../presentation.js";
import { claimPath } from "../site.js";

const sessionKey = "resumilio:discovery:v1";
const visibleNeighborhoodSize = 5;
type Claim = ResumilioProfile["claims"][number];
type AvatarReaction = "idle" | "waiting" | "nod" | "guide" | "smile";
type AvatarLayout = "wide" | "stacked";
type TransitionPhase = "idle" | "out" | "in";
const waitingReactionDelayMs = 24_000;
const stackedAvatarQuery = "(max-width: 700px)";

const avatarMedia: Record<Exclude<AvatarReaction, "guide">, string> = {
  idle: "/media/avatar/daniel-idle.mp4",
  waiting: "/media/avatar/daniel-waiting.mp4",
  nod: "/media/avatar/daniel-nod.mp4",
  smile: "/media/avatar/daniel-smile.mp4",
};
const avatarGuideMedia: Record<AvatarLayout, string> = {
  wide: "/media/avatar/daniel-guide-wide.mp4",
  stacked: "/media/avatar/daniel-guide-stacked.mp4",
};

const copy = {
  en: {
    eyebrow: "Constellation of experience",
    placeholder: "Search roles, skills, or projects",
    search: "Search experience",
    selected: "Now exploring",
    view: "View experience",
    more: "Show similar work",
    reset: "Reset",
    empty: "No experience matches that search. Try a skill, company, or project.",
    graphHelp: "A small set of related experience appears at a time. Select a circle to reform the constellation around it. Use arrow keys to move between visible circles.",
    neighborhood: "Related experience",
    visible: "Showing {visible} of {total} career records. Search or select a circle to reveal more.",
  },
  es: {
    eyebrow: "Constelación de experiencia",
    placeholder: "Busca cargos, habilidades o proyectos",
    search: "Buscar experiencia",
    selected: "Explorando ahora",
    view: "Ver experiencia",
    more: "Ver trabajo similar",
    reset: "Reiniciar",
    empty: "No encontramos experiencia con esa búsqueda. Prueba una habilidad, empresa o proyecto.",
    graphHelp: "Mostramos un grupo pequeño de experiencia relacionada. Elige un círculo para reorganizar la constelación. Usa las flechas para recorrer los círculos visibles.",
    neighborhood: "Experiencia relacionada",
    visible: "Viendo {visible} de {total} registros profesionales. Busca o elige un círculo para descubrir más.",
  },
} as const;

const featuredClaimIds = [
  "claim-alphahub-hubspot-specialist",
  "claim-operations-company-integration-specialist",
  "claim-on-the-fuze-backend-lead",
  "claim-professional-ai-text-completion",
  "claim-hubspot-sms-app",
  "claim-mai-full-stack-developer",
  "claim-masglo-commercial-proposal",
  "claim-computer-science-studies",
];

const graphSlots: Array<{ point: [number, number]; midPoint: [number, number]; className: string }> = [
  { point: [54, 13], midPoint: [58, 21], className: "north" },
  { point: [30, 34], midPoint: [20, 38], className: "west" },
  { point: [83, 31], midPoint: [92, 35], className: "east" },
  { point: [39, 79], midPoint: [22, 81], className: "south-west" },
  { point: [79, 77], midPoint: [91, 79], className: "south-east" },
];

const ambientNodes: Array<{ point: [number, number]; size: number; tone: "quiet" | "outlined" }> = [
  { point: [4, 18], size: 144, tone: "quiet" },
  { point: [20, 72], size: 92, tone: "outlined" },
  { point: [43, 5], size: 74, tone: "outlined" },
  { point: [73, 12], size: 118, tone: "quiet" },
  { point: [97, 18], size: 210, tone: "outlined" },
  { point: [94, 64], size: 310, tone: "quiet" },
  { point: [57, 98], size: 186, tone: "outlined" },
];

function graphTitle(title: string) { return title.split(" — ")[0]; }
function nodeTitle(title: string) {
  const clean = graphTitle(title);
  if (clean.length <= 42) return clean;
  return `${clean.slice(0, 39).replace(/\s+\S*$/, "")}…`;
}
function organizationFor(profile: ResumilioProfile, claim: Claim) {
  return claim.organizationId ? profile.organizations.find((item) => item.id === claim.organizationId) : undefined;
}
function SearchIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/></svg>;
}
function ResetIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7v5h5"/><path d="M5.8 17.2A8 8 0 1 0 4.3 9"/></svg>;
}
function ArrowIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M14 7l5 5-5 5"/></svg>;
}

function AvatarGuide({ reaction, sequence, layout, selectedTitle, selectedLabel, onComplete }: {
  reaction: AvatarReaction; sequence: number; layout: AvatarLayout; selectedTitle: string; selectedLabel: string; onComplete: () => void;
}) {
  const source = reaction === "guide" ? avatarGuideMedia[layout] : avatarMedia[reaction];
  return <figure className="avatar-guide" data-avatar-state={reaction} data-avatar-layout={layout} data-avatar-variant={reaction === "guide" ? layout : "shared"} aria-hidden="true">
    <div className="avatar-node-backdrop"/>
    <div className="avatar-media">
      <img className="avatar-poster" src="/media/avatar/daniel-idle-poster.webp" alt="" width="360" height="640" decoding="async" loading="eager" fetchPriority="high"/>
      <video key={`${reaction}-${layout}-${sequence}`} className="avatar-video" src={source} poster="/media/avatar/daniel-idle-poster.webp" muted playsInline autoPlay loop={reaction === "idle"} preload="auto" onEnded={reaction === "idle" ? undefined : onComplete}/>
    </div>
    <figcaption className="avatar-mobile-callout"><span>{selectedLabel}</span><strong>{graphTitle(selectedTitle)}</strong></figcaption>
  </figure>;
}

function ClaimDetail({ profile, claim, locale, onMoreLike }: {
  profile: ResumilioProfile; claim: Claim; locale: Locale; onMoreLike: () => void;
}) {
  const t = copy[locale];
  const organization = organizationFor(profile, claim);
  return <section className="claim-detail" aria-label={`${t.selected}: ${claim.title[locale]}`} aria-live="polite">
    <p className="detail-label">{t.selected}</p>
    <h2>{graphTitle(claim.title[locale])}</h2>
    {organization && <p className="detail-organization">{organization.name[locale]}</p>}
    <p className="detail-status">{marketLabel(claim.lifecycle, locale)}</p>
    <p className="detail-summary">{marketClaimSummary(claim, locale)}</p>
    <div className="detail-actions">
      <a className="button button--primary" href={claimPath(claim.id, locale)} target="_blank" rel="noopener noreferrer">{t.view}<ArrowIcon/></a>
      <button className="button button--secondary" type="button" onClick={onMoreLike}>{t.more}</button>
    </div>
  </section>;
}

export default function EvidenceExplorer({ profile, initialLocale = profile.profile.defaultLocale }: { profile: ResumilioProfile; initialLocale?: Locale }) {
  const defaultClaimId = profile.claims.find((claim) => claim.id === featuredClaimIds[0])?.id ?? profile.claims[0].id;
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [selectedId, setSelectedId] = useState(defaultClaimId);
  const [query, setQuery] = useState("");
  const [discovery, setDiscovery] = useState<DiscoveryState>(emptyDiscoveryState);
  const [storageReady, setStorageReady] = useState(false);
  const [avatarLayout, setAvatarLayout] = useState<AvatarLayout>("wide");
  const [avatar, setAvatar] = useState<{ reaction: AvatarReaction; sequence: number }>({ reaction: "idle", sequence: 0 });
  const [transition, setTransition] = useState<{ phase: TransitionPhase; targetId?: string }>({ phase: "idle" });
  const transitionTimers = useRef<number[]>([]);
  const t = copy[locale];

  useEffect(() => {
    try { const stored = sessionStorage.getItem(sessionKey); if (stored) setDiscovery(JSON.parse(stored) as DiscoveryState); }
    catch { /* Session adaptation remains optional. */ }
    setStorageReady(true);
  }, []);
  useEffect(() => {
    if (!storageReady) return;
    try { sessionStorage.setItem(sessionKey, JSON.stringify(discovery)); } catch { /* Keep the public experience usable. */ }
  }, [discovery, storageReady]);
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  useEffect(() => () => transitionTimers.current.forEach((timer) => window.clearTimeout(timer)), []);
  useEffect(() => {
    const media = window.matchMedia(stackedAvatarQuery);
    const syncLayout = () => setAvatarLayout(media.matches ? "stacked" : "wide");
    syncLayout();
    media.addEventListener("change", syncLayout);
    return () => media.removeEventListener("change", syncLayout);
  }, []);

  const signal = useCallback((kind: Parameters<typeof applySignal>[1], topics: string[], claimId?: string) => {
    setDiscovery((current) => applySignal(current, kind, topics, claimId));
  }, []);
  const showReaction = useCallback((reaction: Exclude<AvatarReaction, "idle">) => {
    setAvatar((current) => ({ reaction, sequence: current.sequence + 1 }));
  }, []);
  const acknowledgeNode = useCallback(() => {
    setAvatar((current) => current.reaction === "idle" ? { reaction: "nod", sequence: current.sequence + 1 } : current);
  }, []);
  const returnToIdle = useCallback(() => {
    setAvatar((current) => ({ reaction: "idle", sequence: current.sequence + 1 }));
  }, []);
  useEffect(() => {
    if (avatar.reaction !== "idle") return;
    const timer = window.setTimeout(() => showReaction("waiting"), waitingReactionDelayMs);
    return () => window.clearTimeout(timer);
  }, [avatar.reaction, avatar.sequence, showReaction]);

  const selected = profile.claims.find((claim) => claim.id === selectedId) ?? profile.claims[0];
  useEffect(() => {
    const timer = window.setTimeout(() => signal("dwell", selected.tags, selected.id), 8000);
    return () => window.clearTimeout(timer);
  }, [selected.id, selected.tags, signal]);

  const neighborhood = useMemo(() => {
    const normalizedQuery = normalizeTerm(query);
    if (normalizedQuery) {
      return searchClaims(profile, normalizedQuery).map((result) => result.claim).filter((claim) => claim.id !== selected.id).slice(0, visibleNeighborhoodSize);
    }
    const contextualState = applySignal(discovery, "open", selected.tags, selected.id);
    return rankRecommendations(profile, contextualState, selected.id).slice(0, visibleNeighborhoodSize).map((result) => result.claim);
  }, [profile, query, selected.id, selected.tags, discovery]);

  const selectClaim = (claim: Claim, reaction: "guide" | "smile" = "guide") => {
    if (claim.id === selected.id || transition.phase !== "idle") return;
    const commitSelection = () => {
      setSelectedId(claim.id);
      setQuery("");
      signal("open", claim.tags, claim.id);
    };
    showReaction(reaction);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      commitSelection();
      setTransition({ phase: "idle" });
      return;
    }
    transitionTimers.current.forEach((timer) => window.clearTimeout(timer));
    setTransition({ phase: "out", targetId: claim.id });
    transitionTimers.current = [
      window.setTimeout(() => {
        commitSelection();
        setTransition({ phase: "in", targetId: claim.id });
      }, 240),
      window.setTimeout(() => setTransition({ phase: "idle" }), 760),
    ];
  };
  const moveClaimFocus = (event: KeyboardEvent<HTMLButtonElement>, claim: Claim) => {
    const keys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"];
    if (!keys.includes(event.key) || neighborhood.length === 0) return;
    event.preventDefault();
    const current = Math.max(0, neighborhood.findIndex((item) => item.id === claim.id));
    const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? neighborhood.length - 1 : (current + (["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : -1) + neighborhood.length) % neighborhood.length;
    document.getElementById(`claim-node-${neighborhood[nextIndex].id}`)?.focus();
  };
  const moreLike = () => {
    const nextState = applySignal(discovery, "more-like-this", selected.tags, selected.id);
    setDiscovery(nextState);
    const recommendation = rankRecommendations(profile, nextState, selected.id)[0]?.claim;
    if (recommendation) selectClaim(recommendation, "smile");
    else showReaction("smile");
  };
  const submitSearch = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    const firstMatch = searchClaims(profile, query)[0]?.claim;
    signal("search", normalizeTerm(query).split(" ").filter(Boolean));
    if (firstMatch && firstMatch.id !== selected.id) selectClaim(firstMatch, "smile");
    else showReaction("smile");
  };
  const reset = () => {
    setDiscovery(emptyDiscoveryState()); setQuery(""); setSelectedId(defaultClaimId); returnToIdle();
    try { sessionStorage.removeItem(sessionKey); } catch { /* Nothing else to reset. */ }
  };
  const visibleMessage = t.visible.replace("{visible}", String(neighborhood.length + 1)).replace("{total}", String(profile.claims.length));

  return <div className="experience-shell">
    <header className="constellation-header">
      <a className="constellation-wordmark" href={locale === "en" ? "/" : "/es/"}><strong>{profile.profile.name[locale]}</strong><span>{profile.profile.headline[locale]}</span></a>
      <form className="search-controls" role="search" onSubmit={submitSearch}>
        <label className="search-field"><span className="sr-only">{t.search}</span><SearchIcon/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.placeholder}/></label>
      </form>
      <div className="constellation-actions">
        <a className="locale-control" href={locale === "en" ? "/es/" : "/"} onClick={(event) => { event.preventDefault(); setLocale(locale === "en" ? "es" : "en"); }} aria-label={locale === "en" ? "Cambiar a español" : "Switch to English"}><strong className={locale === "en" ? "is-active" : ""}>EN</strong><span>/</span><strong className={locale === "es" ? "is-active" : ""}>ES</strong></a>
        <button className="reset-control" type="button" onClick={reset}><ResetIcon/><span>{t.reset}</span></button>
      </div>
    </header>

    <main className="constellation-main">
      <section className="constellation" aria-label={t.eyebrow} aria-describedby="graph-help">
        <p className="sr-only" id="graph-help">{t.graphHelp}</p>
        <div className="constellation-intro"><p>{t.eyebrow}</p><span>{visibleMessage}</span></div>
        <div className="graph-stage" data-transition-phase={transition.phase}>
          <div className="ambient-nodes" aria-hidden="true">
            {ambientNodes.map((node, index) => <span key={index} className={`ambient-node ambient-node--${node.tone}`} style={{ "--x": `${node.point[0]}%`, "--y": `${node.point[1]}%`, "--size": `${node.size}px`, "--order": index } as CSSProperties}/>) }
          </div>
          <svg className="relationship-map" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {neighborhood.flatMap((claim, index) => {
              const slot = graphSlots[index];
              return [
                <line key={`${claim.id}-wide`} x1="60" y1="54" x2={slot.point[0]} y2={slot.point[1]} className="relation relation--claim relation--wide"/>,
                <line key={`${claim.id}-mid`} x1="59" y1="54" x2={slot.midPoint[0]} y2={slot.midPoint[1]} className="relation relation--claim relation--mid"/>,
              ];
            })}
          </svg>
          <AvatarGuide reaction={avatar.reaction} sequence={avatar.sequence} layout={avatarLayout} selectedTitle={selected.title[locale]} selectedLabel={t.selected} onComplete={returnToIdle}/>
          <div className="claim-graph" role="group" aria-label={t.neighborhood}>
            {neighborhood.map((claim, index) => {
              const slot = graphSlots[index];
              const claimStyle = { "--x": `${slot.point[0]}%`, "--y": `${slot.point[1]}%`, "--order": index } as CSSProperties;
              const promoting = transition.targetId === claim.id && transition.phase === "out";
              return <button key={claim.id} className={`claim-node claim-node--${slot.className}${promoting ? " claim-node--promoting" : ""}`} id={`claim-node-${claim.id}`} data-claim-id={claim.id} style={claimStyle} type="button" disabled={transition.phase !== "idle"} onFocus={acknowledgeNode} onMouseEnter={acknowledgeNode} onKeyDown={(event) => moveClaimFocus(event, claim)} onClick={() => selectClaim(claim)}><strong>{nodeTitle(claim.title[locale])}</strong><small>{marketLabel(claim.lifecycle, locale)}</small></button>;
            })}
          </div>
          <div className="experience-focus" key={selected.id} data-selected-id={selected.id}><ClaimDetail profile={profile} claim={selected} locale={locale} onMoreLike={moreLike}/></div>
          {query && neighborhood.length === 0 && <p className="empty-state" aria-live="polite">{t.empty}</p>}
        </div>
      </section>
      <nav hidden aria-hidden="true">
        {profile.claims.map((claim) => <a key={claim.id} id={claim.id} href={claimPath(claim.id, locale)}>{claim.title[locale]}</a>)}
        {profile.evidence.map((item) => <span key={item.id}>{marketEvidenceTitle(item, locale)}</span>)}
      </nav>
    </main>
  </div>;
}
