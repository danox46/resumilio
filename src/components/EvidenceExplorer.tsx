import { useCallback, useEffect, useMemo, useState, type CSSProperties, type KeyboardEvent } from "react";
import { applySignal, emptyDiscoveryState, normalizeTerm, rankRecommendations, searchClaims, type DiscoveryState } from "../discovery.js";
import type { Locale, ResumilioProfile } from "../profile.js";
import { marketClaimSummary, marketEvidenceTitle, marketLabel, marketRecommendationReason, marketSourceSummary } from "../presentation.js";
import { claimPath } from "../site.js";

const sessionKey = "resumilio:discovery:v1";
type Claim = ResumilioProfile["claims"][number];
type AvatarReaction = "idle" | "waiting" | "nod" | "guide" | "smile";
type AvatarLayout = "wide" | "stacked";
const waitingReactionDelayMs = 24_000;
const stackedAvatarQuery = "(max-width: 820px)";

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
    evidence: "Experience", graph: "Career map", search: "Search", explore: "CRM integrations, backend systems, APIs, and practical automation for real teams and client workflows.",
    placeholder: "Search experience, skills, or projects", allTypes: "All experience", allStatuses: "All statuses",
    allSkills: "All skills", allTime: "Any year", clear: "Clear", selected: "Featured experience", lifecycle: "Career status",
    strength: "How it's documented", visibility: "Available details", recommended: "Why it matters",
    view: "View experience", more: "Show similar work", results: "highlights", allEvidence: "Career highlights",
    listIntro: "Browse Daniel's professional experience, projects, and training.", type: "Category", status: "Status", title: "Role or project",
    keyEvidence: "More about it", reset: "Reset view", powered: "Built with Resumilio", menu: "Open navigation", primaryNav: "Primary navigation",
    empty: "No experience matches this search.", sortBy: "Sort by", relevant: "Most relevant", titleAsc: "Title A–Z",
    graphHelp: "Use the arrow keys to move between visible career highlights. Press Enter or Space to select one.",
    selectedLegend: "Selected highlight", otherLegend: "Related experience", supportLegend: "More context", relationshipLegend: "Related work",
  },
  es: {
    evidence: "Experiencia", graph: "Trayectoria", search: "Buscar", explore: "Integraciones CRM, sistemas backend, APIs y automatización práctica para equipos y flujos de clientes reales.",
    placeholder: "Busca experiencia, habilidades o proyectos", allTypes: "Toda la experiencia", allStatuses: "Todos los estados",
    allSkills: "Todas las habilidades", allTime: "Cualquier año", clear: "Limpiar", selected: "Experiencia destacada", lifecycle: "Estado profesional",
    strength: "Cómo está documentado", visibility: "Detalles disponibles", recommended: "Por qué importa",
    view: "Ver experiencia", more: "Ver trabajo similar", results: "destacados", allEvidence: "Experiencia destacada",
    listIntro: "Explora la experiencia profesional, los proyectos y la formación de Daniel.", type: "Categoría", status: "Estado", title: "Rol o proyecto",
    keyEvidence: "Más información", reset: "Reiniciar vista", powered: "Creado con Resumilio", menu: "Abrir navegación", primaryNav: "Navegación principal",
    empty: "No encontramos experiencia que coincida con esta búsqueda.", sortBy: "Ordenar por", relevant: "Más relevante", titleAsc: "Título A–Z",
    graphHelp: "Usa las flechas para recorrer la experiencia visible. Pulsa Enter o Espacio para seleccionar una.",
    selectedLegend: "Experiencia seleccionada", otherLegend: "Experiencia relacionada", supportLegend: "Más contexto", relationshipLegend: "Trabajo relacionado",
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

const graphSlots: Array<{ claim: [number, number]; side: "left" | "right" }> = [
  { claim: [19, 16], side: "left" },
  { claim: [81, 16], side: "right" },
  { claim: [12, 39], side: "left" },
  { claim: [88, 39], side: "right" },
  { claim: [11, 65], side: "left" },
  { claim: [89, 65], side: "right" },
  { claim: [22, 87], side: "left" },
  { claim: [78, 87], side: "right" },
];

function graphTitle(title: string) {
  return title.split(" — ")[0];
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

function Chevron({ direction = "right" }: { direction?: "right" | "down" }) {
  return <svg className={`chevron chevron--${direction}`} viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>;
}

function evidenceFor(profile: ResumilioProfile, claim: Claim) {
  return profile.evidence.find((item) => item.id === claim.evidenceIds[0])!;
}

function AvatarGuide({ reaction, sequence, layout, mediaReady, selectedTitle, selectedLabel, onComplete }: {
  reaction: AvatarReaction; sequence: number; layout: AvatarLayout; mediaReady: boolean; selectedTitle: string; selectedLabel: string; onComplete: () => void;
}) {
  const source = reaction === "guide" ? avatarGuideMedia[layout] : avatarMedia[reaction];
  return <figure className="avatar-guide" data-avatar-state={reaction} data-avatar-layout={layout} data-avatar-variant={reaction === "guide" ? layout : "shared"} aria-hidden="true">
    <div className="avatar-orbit avatar-orbit--outer"/>
    <div className="avatar-orbit avatar-orbit--inner"/>
    <img className="avatar-poster" src="/media/avatar/daniel-idle-poster.webp" alt="" width="360" height="640" decoding="async" loading="eager" fetchPriority="high"/>
    {mediaReady && <video
      key={`${reaction}-${layout}-${sequence}`}
      className="avatar-video"
      src={source}
      poster="/media/avatar/daniel-idle-poster.webp"
      muted
      playsInline
      autoPlay
      loop={reaction === "idle"}
      preload={reaction === "idle" ? "auto" : "metadata"}
      onEnded={reaction === "idle" ? undefined : onComplete}
    />}
    <figcaption className="avatar-mobile-callout"><span>{selectedLabel}</span><strong>{graphTitle(selectedTitle)}</strong></figcaption>
  </figure>;
}

function ClaimDetail({ profile, claim, locale, state, compact = false, onMoreLike }: {
  profile: ResumilioProfile; claim: Claim; locale: Locale; state: DiscoveryState; compact?: boolean; onMoreLike: () => void;
}) {
  const t = copy[locale];
  const evidence = evidenceFor(profile, claim);
  const organization = organizationFor(profile, claim);
  const reason = marketRecommendationReason(state, locale);
  const visibility = marketSourceSummary(evidence, locale);
  return <section className={compact ? "claim-detail claim-detail--compact" : "claim-detail"} aria-label={`${t.selected}: ${claim.title[locale]}`} aria-live="polite">
    <p className="detail-label">{t.selected}</p>
    <h2>{claim.title[locale]}</h2>
    {organization && <p className="detail-organization">{organization.name[locale]}</p>}
    <p className="detail-status">{marketLabel(claim.lifecycle, locale)}</p>
    <p className="detail-summary">{marketClaimSummary(claim, locale)}</p>
    <dl>
      <div><dt>{t.lifecycle}</dt><dd>{marketLabel(claim.lifecycle, locale)}</dd></div>
      <div><dt>{t.strength}</dt><dd>{marketLabel(evidence.strength, locale)}</dd></div>
      <div><dt>{t.visibility}</dt><dd>{visibility}</dd></div>
      <div><dt>{t.recommended}</dt><dd>{reason}</dd></div>
    </dl>
    <div className="detail-actions">
      <a className="button button--primary" href={`${claimPath(claim.id, locale)}#${evidence.id}`}>{t.view}</a>
      <button className="button button--secondary" type="button" onClick={onMoreLike}>{t.more}</button>
    </div>
  </section>;
}

export default function EvidenceExplorer({ profile, initialLocale = profile.profile.defaultLocale }: { profile: ResumilioProfile; initialLocale?: Locale }) {
  const defaultClaimId = profile.claims.find((claim) => claim.id === featuredClaimIds[0])?.id ?? profile.claims[0].id;
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [selectedId, setSelectedId] = useState(defaultClaimId);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [lifecycle, setLifecycle] = useState("");
  const [tag, setTag] = useState("");
  const [sort, setSort] = useState<"relevant" | "title">("relevant");
  const [menuOpen, setMenuOpen] = useState(false);
  const [discovery, setDiscovery] = useState<DiscoveryState>(emptyDiscoveryState);
  const [storageReady, setStorageReady] = useState(false);
  const [mediaReady, setMediaReady] = useState(false);
  const [avatarLayout, setAvatarLayout] = useState<AvatarLayout>("wide");
  const [avatar, setAvatar] = useState<{ reaction: AvatarReaction; sequence: number }>({ reaction: "idle", sequence: 0 });
  const t = copy[locale];

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(sessionKey);
      if (stored) setDiscovery(JSON.parse(stored) as DiscoveryState);
    } catch { /* Session adaptation remains optional. */ }
    setStorageReady(true);
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    try { sessionStorage.setItem(sessionKey, JSON.stringify(discovery)); } catch { /* Keep the public experience usable. */ }
  }, [discovery, storageReady]);

  useEffect(() => { document.documentElement.lang = locale; }, [locale]);

  useEffect(() => {
    const media = window.matchMedia(stackedAvatarQuery);
    const syncLayout = () => setAvatarLayout(media.matches ? "stacked" : "wide");
    syncLayout();
    media.addEventListener("change", syncLayout);
    return () => media.removeEventListener("change", syncLayout);
  }, []);

  useEffect(() => {
    const removeMotionListeners = () => {
      window.removeEventListener("pointermove", beginMotion);
      window.removeEventListener("keydown", beginMotion);
      window.removeEventListener("touchstart", beginMotion);
    };
    const beginMotion = () => {
      setMediaReady(true);
      removeMotionListeners();
    };
    window.addEventListener("pointermove", beginMotion, { once: true, passive: true });
    window.addEventListener("keydown", beginMotion, { once: true });
    window.addEventListener("touchstart", beginMotion, { once: true, passive: true });
    return removeMotionListeners;
  }, []);

  const signal = useCallback((kind: Parameters<typeof applySignal>[1], topics: string[], claimId?: string) => {
    setDiscovery((current) => applySignal(current, kind, topics, claimId));
  }, []);

  const showReaction = useCallback((reaction: Exclude<AvatarReaction, "idle">) => {
    setAvatar((current) => ({ reaction, sequence: current.sequence + 1 }));
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

  const results = useMemo(() => {
    const searched = searchClaims(profile, query, { type, lifecycle, tag });
    if (sort === "title") return [...searched].sort((a, b) => a.claim.title[locale].localeCompare(b.claim.title[locale]));
    if (query || type || lifecycle || tag || discovery.signalCount === 0) return searched;
    const order = new Map(rankRecommendations(profile, discovery).map((item, index) => [item.claim.id, index]));
    return [...searched].sort((a, b) => (order.get(a.claim.id) ?? 99) - (order.get(b.claim.id) ?? 99));
  }, [profile, query, type, lifecycle, tag, sort, locale, discovery]);

  const visibleIds = new Set(results.map((item) => item.claim.id));
  const resultClaims = results.map((item) => item.claim);
  const resultById = new Map(resultClaims.map((claim) => [claim.id, claim]));
  const featured = featuredClaimIds.map((id) => resultById.get(id)).filter((claim): claim is Claim => Boolean(claim));
  const graphClaims = [...featured, ...resultClaims.filter((claim) => !featuredClaimIds.includes(claim.id))].slice(0, graphSlots.length);
  const graphPoints = new Map(graphClaims.map((claim, index) => [claim.id, graphSlots[index]]));
  const tags = [...new Set(profile.claims.flatMap((claim) => claim.tags))].sort();
  const selectClaim = (claim: Claim, react = true) => {
    setSelectedId(claim.id);
    signal("open", claim.tags, claim.id);
    if (react) showReaction("guide");
  };
  const moveClaimFocus = (event: KeyboardEvent<HTMLButtonElement>, claim: Claim) => {
    const keys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"];
    if (!keys.includes(event.key) || graphClaims.length === 0) return;
    event.preventDefault();
    const current = Math.max(0, graphClaims.findIndex((item) => item.id === claim.id));
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? graphClaims.length - 1
        : (current + (["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : -1) + graphClaims.length) % graphClaims.length;
    const next = graphClaims[nextIndex];
    selectClaim(next, false);
    window.requestAnimationFrame(() => {
      document.getElementById(`claim-node-${next.id}`)?.focus();
      showReaction("guide");
    });
  };
  const moreLike = () => {
    const next = applySignal(discovery, "more-like-this", selected.tags, selected.id);
    setDiscovery(next);
    const recommendation = rankRecommendations(profile, next, selected.id)[0]?.claim;
    if (recommendation) setSelectedId(recommendation.id);
    showReaction("smile");
  };
  const submitSearch = (event: { preventDefault: () => void }) => { event.preventDefault(); signal("search", normalizeTerm(query).split(" ")); showReaction("smile"); };
  const reset = () => {
    setDiscovery(emptyDiscoveryState()); setQuery(""); setType(""); setLifecycle(""); setTag(""); setSort("relevant"); setSelectedId(defaultClaimId);
    returnToIdle();
    try { sessionStorage.removeItem(sessionKey); } catch { /* Nothing else to reset. */ }
  };

  return <div className="experience-shell">
    <header className="site-header">
      <a className="wordmark" href="#top">{profile.profile.name[locale]}</a>
      <button className="menu-button" type="button" aria-label={t.menu} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}><span/><span/><span/></button>
      <nav className={menuOpen ? "primary-nav primary-nav--open" : "primary-nav"} aria-label={t.primaryNav}>
        <a href="#evidence">{t.evidence}</a><a href="#graph">{t.graph}</a><a href="#search">{t.search}</a>
      </nav>
      <div className="header-actions">
        <a className="locale-control" href={locale === "en" ? "/es/" : "/"} onClick={(event) => { event.preventDefault(); setLocale(locale === "en" ? "es" : "en"); }} aria-label={locale === "en" ? "Cambiar a español" : "Switch to English"}><strong>EN</strong><span>/</span><strong>ES</strong></a>
        <button className="reset-control" type="button" onClick={reset}><ResetIcon/>{t.reset}</button>
      </div>
    </header>

    <main id="top">
      <section className="introduction" aria-labelledby="person-name">
        <h1 id="person-name">{profile.profile.name[locale]}</h1>
        <p className="headline">{profile.profile.headline[locale]}</p>
        <p className="intro-copy">{profile.profile.summary[locale]}</p>
      </section>

      <form className="search-controls" id="search" role="search" onSubmit={submitSearch}>
        <label className="search-field"><span className="sr-only">{t.search}</span><SearchIcon/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.placeholder}/></label>
        <select aria-label={t.allTypes} value={type} onChange={(event) => { setType(event.target.value); if (event.target.value) { signal("filter", [event.target.value]); showReaction("smile"); } }}><option value="">{t.allTypes}</option>{[...new Set(profile.claims.map((claim) => claim.type))].map((value) => <option key={value} value={value}>{marketLabel(value, locale)}</option>)}</select>
        <select aria-label={t.allStatuses} value={lifecycle} onChange={(event) => { setLifecycle(event.target.value); if (event.target.value) { signal("filter", [event.target.value]); showReaction("smile"); } }}><option value="">{t.allStatuses}</option>{[...new Set(profile.claims.map((claim) => claim.lifecycle))].map((value) => <option key={value} value={value}>{marketLabel(value, locale)}</option>)}</select>
        <select aria-label={t.allSkills} value={tag} onChange={(event) => { setTag(event.target.value); if (event.target.value) { signal("filter", [event.target.value]); showReaction("smile"); } }}><option value="">{t.allSkills}</option>{tags.map((value) => <option key={value} value={value}>{marketLabel(value, locale)}</option>)}</select>
        <button className="clear-control" type="button" onClick={() => { setQuery(""); setType(""); setLifecycle(""); setTag(""); }}>{t.clear}</button>
      </form>

      <section className="constellation" id="graph" aria-label={locale === "en" ? "Career highlights map" : "Mapa de experiencia profesional"} aria-describedby="graph-help">
        <p className="sr-only" id="graph-help">{t.graphHelp}</p>
        <div className="graph-stage">
          <svg className="relationship-map" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {graphClaims.map((claim) => { const point = graphPoints.get(claim.id)!; return <line key={`career-${claim.id}`} x1="50" y1="51" x2={point.claim[0]} y2={point.claim[1]} className={`relation relation--claim${claim.id === selected.id ? " relation--selected" : ""}`}/>; })}
          </svg>
          <AvatarGuide reaction={avatar.reaction} sequence={avatar.sequence} layout={avatarLayout} mediaReady={mediaReady} selectedTitle={selected.title[locale]} selectedLabel={t.selected} onComplete={returnToIdle}/>
          <div className="claim-graph">
            {graphClaims.map((claim) => {
              const point = graphPoints.get(claim.id)!;
              const isSelected = claim.id === selected.id;
              const hidden = !visibleIds.has(claim.id);
              const claimStyle = { "--x": `${point.claim[0]}%`, "--y": `${point.claim[1]}%` } as CSSProperties;
              return <article key={claim.id} className={`graph-branch graph-branch--${point.side}${isSelected ? " graph-branch--selected" : ""}${hidden ? " graph-branch--hidden" : ""}`}>
                <button className="claim-node" id={`claim-node-${claim.id}`} data-claim-id={claim.id} style={claimStyle} type="button" aria-pressed={isSelected} disabled={hidden} onFocus={() => showReaction("nod")} onMouseEnter={() => showReaction("nod")} onKeyDown={(event) => moveClaimFocus(event, claim)} onClick={() => selectClaim(claim)}><span className="node-dot" aria-hidden="true"/><span><strong>{graphTitle(claim.title[locale])}</strong><small>{marketLabel(claim.lifecycle, locale)}{claim.tags.includes("non-ai") ? (locale === "en" ? " · no AI" : " · sin IA") : ""}</small></span></button>
                {isSelected && <ClaimDetail profile={profile} claim={claim} locale={locale} state={discovery} compact onMoreLike={moreLike}/>}
              </article>;
            })}
          </div>
          {!results.length && <p className="empty-state">{t.empty}</p>}
        </div>
        <ClaimDetail profile={profile} claim={selected} locale={locale} state={discovery} onMoreLike={moreLike}/>
      </section>

      <section className="evidence-list" id="evidence" aria-labelledby="evidence-heading">
        <div className="list-heading"><div><h2 id="evidence-heading">{t.allEvidence} <span>({results.length} {t.results})</span></h2><p>{t.listIntro}</p></div><label className="sort-control"><span>{t.sortBy}</span><select value={sort} onChange={(event) => setSort(event.target.value as "relevant" | "title")}><option value="relevant">{t.relevant}</option><option value="title">{t.titleAsc}</option></select></label></div>
        <div className="evidence-table" role="table" aria-label={t.allEvidence}>
          <div className="evidence-row evidence-row--header" role="row"><span role="columnheader">{t.title}</span><span role="columnheader">{t.type}</span><span role="columnheader">{t.status}</span><span role="columnheader">{t.keyEvidence}</span><span role="columnheader">{t.strength}</span><span/></div>
          {results.map(({ claim }) => { const evidence = evidenceFor(profile, claim); return <article className="evidence-row" role="row" id={claim.id} key={claim.id} onClick={() => selectClaim(claim)}>
            <a role="cell" href={claimPath(claim.id, locale)} onClick={(event) => { event.stopPropagation(); signal("open", claim.tags, claim.id); }}>{claim.title[locale]}</a><span role="cell">{marketLabel(claim.type, locale)}</span><span role="cell">{marketLabel(claim.lifecycle, locale)}{claim.tags.includes("non-ai") ? (locale === "en" ? " · no AI" : " · sin IA") : ""}</span><span role="cell" id={evidence.id}>{evidence.source.url ? <a href={evidence.source.url} target="_blank" rel="noreferrer" onClick={() => signal("source-visit", claim.tags, claim.id)}>{marketEvidenceTitle(evidence, locale)}</a> : marketEvidenceTitle(evidence, locale)}</span><span role="cell">{marketLabel(evidence.strength, locale)}</span><Chevron/></article>; })}
        </div>
      </section>
    </main>

    <footer><span>{t.powered}</span><button className="reset-control reset-control--mobile" type="button" onClick={reset}><ResetIcon/>{t.reset}</button><a className="locale-control" href={locale === "en" ? "/es/" : "/"} onClick={(event) => { event.preventDefault(); setLocale(locale === "en" ? "es" : "en"); }}><strong>EN</strong><span>/</span><strong>ES</strong></a></footer>
  </div>;
}
