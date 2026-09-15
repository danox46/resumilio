import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { pickAmbientAvatarReaction, type AmbientAvatarReaction } from "../avatar-schedule.js";
import {
  buildLayerPlan,
  buildSuccessorLayer,
  constellationFocus,
  constellationSlots,
  type ConstellationDrift,
  type ConstellationPoint,
  type SuccessorLayerPlan,
} from "../constellation-layers.js";
import { applySignal, emptyDiscoveryState, normalizeTerm, rankRecommendations, searchClaims, type DiscoveryState } from "../discovery.js";
import type { Locale, ResumilioProfile } from "../profile.js";
import { marketClaimSummary, marketEvidenceTitle, marketLabel } from "../presentation.js";
import { claimPath } from "../site.js";

const sessionKey = "resumilio:discovery:v1";
const visibleNeighborhoodSize = 5;
type Claim = ResumilioProfile["claims"][number];
type InteractiveAvatarReaction = "nod" | "guide" | "smile";
type AvatarReaction = AmbientAvatarReaction | InteractiveAvatarReaction;
type AvatarPlayback = { reaction: AvatarReaction; sequence: number; mode: "ambient" | "interactive" };
type AvatarLayout = "wide" | "stacked";
type TransitionPhase = "idle" | "out" | "in";
type SelectionSignal = { kind: "search" | "more-like-this"; topics: string[]; claimId?: string };
type SelectionIntent = { claimId: string; reaction: "guide" | "smile"; precedingSignal?: SelectionSignal };
type ActiveTransition = {
  phase: Exclude<TransitionPhase, "idle">;
  layer: SuccessorLayerPlan;
  fromSelectedId: string;
  fromNeighborhoodIds: string[];
};
type TransitionState = { phase: "idle" } | ActiveTransition;
type RetiredNode = { claimId: string; point: ConstellationPoint };
const stackedAvatarQuery = "(max-width: 700px)";
const transitionCommitMs = 320;
const transitionSettleMs = 700;

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

const decorativeNodes: Array<{ point: [number, number]; size: number; tone: "quiet" | "outlined" }> = [
  { point: [4, 18], size: 144, tone: "quiet" },
  { point: [97, 18], size: 210, tone: "outlined" },
  { point: [94, 64], size: 310, tone: "quiet" },
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

function AvatarGuide({ reaction, sequence, mode, layout, selectedTitle, selectedLabel, onComplete }: {
  reaction: AvatarReaction; sequence: number; mode: AvatarPlayback["mode"]; layout: AvatarLayout; selectedTitle: string; selectedLabel: string; onComplete: () => void;
}) {
  const source = reaction === "guide" ? avatarGuideMedia[layout] : avatarMedia[reaction];
  return <figure className="avatar-guide" data-avatar-state={reaction} data-avatar-mode={mode} data-avatar-sequence={sequence} data-avatar-layout={layout} data-avatar-variant={reaction === "guide" ? layout : "shared"} aria-hidden="true">
    <div className="avatar-node-backdrop"/>
    <div className="avatar-media">
      <img className="avatar-poster" src="/media/avatar/daniel-idle-poster.webp" alt="" width="360" height="640" decoding="async" loading="eager" fetchPriority="high"/>
      <video key={`${reaction}-${layout}-${sequence}`} className="avatar-video" src={source} poster="/media/avatar/daniel-idle-poster.webp" muted playsInline autoPlay preload="auto" onEnded={onComplete}/>
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
  const [avatar, setAvatar] = useState<AvatarPlayback>({ reaction: "idle", sequence: 0, mode: "ambient" });
  const [slotByClaimId, setSlotByClaimId] = useState<Record<string, number>>({});
  const [transition, setTransition] = useState<TransitionState>({ phase: "idle" });
  const [queuedSelection, setQueuedSelection] = useState<SelectionIntent>();
  const [retiredNodes, setRetiredNodes] = useState<RetiredNode[]>([]);
  const [hasTransitioned, setHasTransitioned] = useState(false);
  const transitionTimers = useRef<number[]>([]);
  const requestSelectionRef = useRef<(intent: SelectionIntent) => void>(() => undefined);
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
  const showReaction = useCallback((reaction: InteractiveAvatarReaction) => {
    setAvatar((current) => ({ reaction, sequence: current.sequence + 1, mode: "interactive" }));
  }, []);
  const advanceAmbientReaction = useCallback(() => {
    setAvatar((current) => ({ reaction: pickAmbientAvatarReaction(), sequence: current.sequence + 1, mode: "ambient" }));
  }, []);
  const acknowledgeNode = useCallback(() => {
    setAvatar((current) => current.mode === "ambient" ? { reaction: "nod", sequence: current.sequence + 1, mode: "interactive" } : current);
  }, []);
  const resetAvatar = useCallback(() => {
    setAvatar((current) => ({ reaction: "idle", sequence: current.sequence + 1, mode: "ambient" }));
  }, []);

  const selected = profile.claims.find((claim) => claim.id === selectedId) ?? profile.claims[0];
  useEffect(() => {
    if (transition.phase !== "idle") return;
    const timer = window.setTimeout(() => signal("dwell", selected.tags, selected.id), 8000);
    return () => window.clearTimeout(timer);
  }, [selected.id, selected.tags, signal, transition.phase]);

  const neighborhood = useMemo(() => {
    const normalizedQuery = normalizeTerm(query);
    if (normalizedQuery) {
      return searchClaims(profile, normalizedQuery).map((result) => result.claim).filter((claim) => claim.id !== selected.id).slice(0, visibleNeighborhoodSize);
    }
    const contextualState = applySignal(discovery, "open", selected.tags, selected.id);
    return rankRecommendations(profile, contextualState, selected.id).slice(0, visibleNeighborhoodSize).map((result) => result.claim);
  }, [profile, query, selected.id, selected.tags, discovery]);
  const neighborhoodIds = useMemo(() => neighborhood.map((claim) => claim.id), [neighborhood]);
  const layerPlan = useMemo(
    () => buildLayerPlan(profile, discovery, selected.id, neighborhoodIds, slotByClaimId),
    [profile, discovery, selected.id, neighborhoodIds, slotByClaimId],
  );

  const requestSelection = useCallback((intent: SelectionIntent) => {
    const claim = profile.claims.find((candidate) => candidate.id === intent.claimId);
    if (!claim) return;
    if (transition.phase !== "idle") {
      setQueuedSelection(intent);
      return;
    }

    let discoveryBeforeOpen = discovery;
    if (intent.precedingSignal) {
      discoveryBeforeOpen = applySignal(
        discoveryBeforeOpen,
        intent.precedingSignal.kind,
        intent.precedingSignal.topics,
        intent.precedingSignal.claimId,
      );
    }
    if (claim.id === selected.id) {
      if (intent.precedingSignal) setDiscovery(discoveryBeforeOpen);
      setQuery("");
      showReaction("smile");
      return;
    }

    const preloaded = intent.precedingSignal
      ? undefined
      : layerPlan.successors.find((candidate) => candidate.targetId === claim.id);
    const layer = preloaded ?? buildSuccessorLayer(
      profile,
      discoveryBeforeOpen,
      selected.id,
      neighborhoodIds,
      layerPlan.slotByClaimId,
      claim.id,
    );
    showReaction(intent.reaction);
    setHasTransitioned(true);
    transitionTimers.current.forEach((timer) => window.clearTimeout(timer));

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDiscovery(layer.nextDiscovery);
      setSelectedId(claim.id);
      setQuery("");
      setSlotByClaimId(layer.nextSlotByClaimId);
      setRetiredNodes([]);
      setTransition({ phase: "idle" });
      return;
    }

    const snapshot: ActiveTransition = {
      phase: "out",
      layer,
      fromSelectedId: selected.id,
      fromNeighborhoodIds: [...neighborhoodIds],
    };
    setTransition(snapshot);
    transitionTimers.current = [
      window.setTimeout(() => {
        setDiscovery(layer.nextDiscovery);
        setSelectedId(claim.id);
        setQuery("");
        setSlotByClaimId(layer.nextSlotByClaimId);
        setTransition((current) => current.phase === "idle" ? current : { ...current, phase: "in" });
      }, transitionCommitMs),
      window.setTimeout(() => {
        const nextRetired = layer.outgoingIds.map((claimId) => ({ claimId, point: layer.retreatPointByClaimId[claimId] }));
        if (!layer.previousCenterRetained) nextRetired.push({ claimId: selected.id, point: [96, 88] });
        setRetiredNodes(nextRetired);
        setTransition({ phase: "idle" });
      }, transitionSettleMs),
    ];
  }, [discovery, layerPlan, neighborhoodIds, profile, selected.id, showReaction, transition.phase]);
  useEffect(() => { requestSelectionRef.current = requestSelection; }, [requestSelection]);
  useEffect(() => {
    if (transition.phase !== "idle" || !queuedSelection) return;
    const next = queuedSelection;
    setQueuedSelection(undefined);
    requestSelectionRef.current(next);
  }, [queuedSelection, transition.phase]);

  const selectClaim = (claim: Claim, reaction: "guide" | "smile" = "guide") => requestSelection({ claimId: claim.id, reaction });
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
    const recommendation = rankRecommendations(profile, nextState, selected.id)[0]?.claim;
    if (recommendation) requestSelection({
      claimId: recommendation.id,
      reaction: "smile",
      precedingSignal: { kind: "more-like-this", topics: selected.tags, claimId: selected.id },
    });
    else { setDiscovery(nextState); showReaction("smile"); }
  };
  const submitSearch = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    const firstMatch = searchClaims(profile, query)[0]?.claim;
    const topics = normalizeTerm(query).split(" ").filter(Boolean);
    if (firstMatch) requestSelection({ claimId: firstMatch.id, reaction: "smile", precedingSignal: { kind: "search", topics } });
    else { setDiscovery((current) => applySignal(current, "search", topics)); showReaction("smile"); }
  };
  const reset = () => {
    transitionTimers.current.forEach((timer) => window.clearTimeout(timer));
    setDiscovery(emptyDiscoveryState()); setQuery(""); setSelectedId(defaultClaimId); setSlotByClaimId({});
    setTransition({ phase: "idle" }); setQueuedSelection(undefined); setRetiredNodes([]); setHasTransitioned(false); resetAvatar();
    try { sessionStorage.removeItem(sessionKey); } catch { /* Nothing else to reset. */ }
  };
  const visibleMessage = t.visible.replace("{visible}", String(neighborhood.length + 1)).replace("{total}", String(profile.claims.length));
  const transitionLayer = transition.phase === "idle" ? undefined : transition.layer;
  const backgroundReserves = layerPlan.successors.flatMap((layer) => layer.reserveNodes)
    .filter((node) => transition.phase !== "out" || node.ownerId !== transition.layer.targetId);
  const transitioningReserves = transitionLayer?.reserveNodes ?? [];
  const queuedTargetOrigin = transition.phase !== "idle" && !transition.fromNeighborhoodIds.includes(transition.layer.targetId)
    ? retiredNodes.find((node) => node.claimId === transition.layer.targetId)?.point ?? [43, 5] as ConstellationPoint
    : undefined;
  const renderedNodes = neighborhood.map((claim, index) => {
    let slotIndex = layerPlan.slotByClaimId[claim.id] ?? index;
    let drift: ConstellationDrift = layerPlan.driftByClaimId[claim.id] ?? [0, 0];
    let role = hasTransitioned ? "settled" : "initial";
    if (transition.phase === "out") {
      if (transition.layer.targetId === claim.id) role = "selected-target";
      else if (transition.layer.outgoingIds.includes(claim.id)) role = "outgoing";
      else if (transition.layer.sharedIds.includes(claim.id)) {
        role = "shared";
        slotIndex = transition.layer.nextSlotByClaimId[claim.id];
        drift = transition.layer.nextDriftByClaimId[claim.id];
      }
    } else if (transition.phase === "in") {
      if (transition.layer.previousCenterRetained && claim.id === transition.fromSelectedId) role = "previous-center";
      else if (transition.layer.incomingIds.includes(claim.id)) role = "incoming";
      else if (transition.layer.sharedIds.includes(claim.id)) role = "shared";
    }
    const slot = constellationSlots[slotIndex] ?? constellationSlots[index];
    const reserveSource = transitionLayer?.reserveNodes.find((node) => node.claimId === claim.id);
    return { claim, slot, drift, role, reserveSource };
  });

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
        <div
          className="graph-stage"
          data-transition-phase={transition.phase}
          data-transition-target={transitionLayer?.targetId}
          data-layer-count={layerPlan.successors.length}
          data-reserve-count={layerPlan.reserveCount}
          data-queued-claim={queuedSelection?.claimId}
          aria-busy={transition.phase !== "idle"}
        >
          <div className="ambient-nodes" aria-hidden="true">
            {decorativeNodes.map((node, index) => <span key={index} className={`ambient-node ambient-node--${node.tone}`} style={{ "--x": `${node.point[0]}%`, "--y": `${node.point[1]}%`, "--size": `${node.size}px`, "--order": index } as CSSProperties}/>) }
            {retiredNodes.map((node, index) => <span key={`${node.claimId}:${index}`} className="retired-node" data-claim-id={node.claimId} style={{ "--x": `${node.point[0]}%`, "--y": `${node.point[1]}%`, "--order": index } as CSSProperties}/>) }
          </div>
          <div className="reserve-layers" aria-hidden="true">
            {backgroundReserves.map((node, index) => <span
              key={node.key}
              className="reserve-node"
              data-reserve-owner={node.ownerId}
              data-claim-id={node.claimId}
              style={{
                "--x": `${node.origin[0]}%`, "--y": `${node.origin[1]}%`,
                "--reserve-scale": node.scale, "--order": index,
              } as CSSProperties}
            />)}
          </div>
          {transitionLayer && <div className="transition-reserves" aria-hidden="true">
            {transitioningReserves.map((node, index) => <span
              key={`transition:${node.key}`}
              className="reserve-node reserve-node--advancing"
              data-reserve-owner={node.ownerId}
              data-claim-id={node.claimId}
              style={{
                "--from-x": `${node.origin[0]}%`, "--from-y": `${node.origin[1]}%`,
                "--to-x": `${node.destination[0]}%`, "--to-y": `${node.destination[1]}%`,
                "--drift-x": `${node.drift[0]}px`, "--drift-y": `${node.drift[1]}px`,
                "--reserve-scale": node.scale, "--order": index,
              } as CSSProperties}
            />)}
            {queuedTargetOrigin && <span className="queued-target-node" data-claim-id={transitionLayer.targetId} style={{
              "--from-x": `${queuedTargetOrigin[0]}%`, "--from-y": `${queuedTargetOrigin[1]}%`,
              "--to-x": `${constellationFocus[0]}%`, "--to-y": `${constellationFocus[1]}%`,
            } as CSSProperties}/>}
          </div>}
          <svg className="relationship-map" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {renderedNodes.flatMap(({ claim, slot }) => {
              return [
                <line key={`${claim.id}-wide`} x1={constellationFocus[0]} y1={constellationFocus[1]} x2={slot.point[0]} y2={slot.point[1]} className="relation relation--claim relation--wide"/>,
                <line key={`${claim.id}-mid`} x1="59" y1={constellationFocus[1]} x2={slot.midPoint[0]} y2={slot.midPoint[1]} className="relation relation--claim relation--mid"/>,
              ];
            })}
          </svg>
          <AvatarGuide reaction={avatar.reaction} sequence={avatar.sequence} mode={avatar.mode} layout={avatarLayout} selectedTitle={selected.title[locale]} selectedLabel={t.selected} onComplete={advanceAmbientReaction}/>
          <div className="claim-graph" role="group" aria-label={t.neighborhood}>
            {renderedNodes.map(({ claim, slot, drift, role, reserveSource }, index) => {
              const retreat = transitionLayer?.retreatPointByClaimId[claim.id];
              const claimStyle = {
                "--x": `${slot.point[0]}%`, "--y": `${slot.point[1]}%`, "--order": index,
                "--drift-x": `${drift[0]}px`, "--drift-y": `${drift[1]}px`,
                ...(retreat ? { "--retreat-x": `${retreat[0]}%`, "--retreat-y": `${retreat[1]}%` } : {}),
                ...(reserveSource ? {
                  "--from-x": `${reserveSource.origin[0]}%`, "--from-y": `${reserveSource.origin[1]}%`,
                  "--reserve-scale": reserveSource.scale,
                } : {}),
              } as CSSProperties;
              return <button
                key={claim.id}
                className={`claim-node claim-node--${slot.className} claim-node--${role}`}
                id={`claim-node-${claim.id}`}
                data-claim-id={claim.id}
                data-node-role={role}
                style={claimStyle}
                type="button"
                onFocus={acknowledgeNode}
                onMouseEnter={acknowledgeNode}
                onKeyDown={(event) => moveClaimFocus(event, claim)}
                onClick={() => selectClaim(claim)}
              ><strong>{nodeTitle(claim.title[locale])}</strong><small>{marketLabel(claim.lifecycle, locale)}</small></button>;
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
