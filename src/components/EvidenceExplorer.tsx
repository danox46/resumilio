import { useCallback, useEffect, useMemo, useState, type CSSProperties, type KeyboardEvent } from "react";
import { applySignal, emptyDiscoveryState, normalizeTerm, rankRecommendations, searchClaims, type DiscoveryState } from "../discovery.js";
import type { Locale, ResumilioProfile } from "../profile.js";
import { marketClaimSummary, marketEvidenceTitle, marketLabel, marketRecommendationReason, marketSourceSummary } from "../presentation.js";
import { claimPath } from "../site.js";

const sessionKey = "resumilio:discovery:v1";
type Claim = ResumilioProfile["claims"][number];

const copy = {
  en: {
    evidence: "Experience", graph: "Career map", search: "Search", explore: "CRM integrations, backend systems, APIs, and practical automation for real teams and client workflows.",
    placeholder: "Search experience, skills, or projects", allTypes: "All experience", allStatuses: "All stages",
    allSkills: "All skills", allTime: "Any year", clear: "Clear", selected: "Featured experience", lifecycle: "Project stage",
    strength: "Portfolio format", visibility: "Available details", recommended: "Why it matters",
    view: "View experience", more: "Show similar work", results: "highlights", allEvidence: "Career highlights",
    listIntro: "Browse Daniel's professional experience, projects, and training.", type: "Category", status: "Stage", title: "Role or project",
    keyEvidence: "More about it", reset: "Reset view", powered: "Built with Resumilio", menu: "Open navigation", primaryNav: "Primary navigation",
    empty: "No experience matches this search.", sortBy: "Sort by", relevant: "Most relevant", titleAsc: "Title A–Z",
    graphHelp: "Use the arrow keys to move between visible career highlights. Press Enter or Space to select one.",
    selectedLegend: "Selected highlight", otherLegend: "Related experience", supportLegend: "More context", relationshipLegend: "Related work",
  },
  es: {
    evidence: "Experiencia", graph: "Trayectoria", search: "Buscar", explore: "Integraciones CRM, sistemas backend, APIs y automatización práctica para equipos y flujos de clientes reales.",
    placeholder: "Busca experiencia, habilidades o proyectos", allTypes: "Toda la experiencia", allStatuses: "Todas las etapas",
    allSkills: "Todas las habilidades", allTime: "Cualquier año", clear: "Limpiar", selected: "Experiencia destacada", lifecycle: "Etapa del proyecto",
    strength: "Formato del portafolio", visibility: "Detalles disponibles", recommended: "Por qué importa",
    view: "Ver experiencia", more: "Ver trabajo similar", results: "destacados", allEvidence: "Experiencia destacada",
    listIntro: "Explora la experiencia profesional, los proyectos y la formación de Daniel.", type: "Categoría", status: "Etapa", title: "Rol o proyecto",
    keyEvidence: "Más información", reset: "Reiniciar vista", powered: "Creado con Resumilio", menu: "Abrir navegación", primaryNav: "Navegación principal",
    empty: "No encontramos experiencia que coincida con esta búsqueda.", sortBy: "Ordenar por", relevant: "Más relevante", titleAsc: "Título A–Z",
    graphHelp: "Usa las flechas para recorrer la experiencia visible. Pulsa Enter o Espacio para seleccionar una.",
    selectedLegend: "Experiencia seleccionada", otherLegend: "Experiencia relacionada", supportLegend: "Más contexto", relationshipLegend: "Trabajo relacionado",
  },
} as const;

const layout: Record<string, { claim: [number, number]; evidence: [number, number] }> = {
  "claim-professional-ai-text-completion": { claim: [58, 31], evidence: [62, 9] },
  "claim-hubspot-sms-app": { claim: [40, 65], evidence: [40, 88] },
  "claim-masglo-commercial-proposal": { claim: [20, 40], evidence: [8, 28] },
  "claim-google-cloud-big-data-course": { claim: [78, 70], evidence: [80, 91] },
};

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

function ClaimDetail({ profile, claim, locale, state, compact = false, onMoreLike }: {
  profile: ResumilioProfile; claim: Claim; locale: Locale; state: DiscoveryState; compact?: boolean; onMoreLike: () => void;
}) {
  const t = copy[locale];
  const evidence = evidenceFor(profile, claim);
  const reason = marketRecommendationReason(state, locale);
  const visibility = marketSourceSummary(evidence, locale);
  return <section className={compact ? "claim-detail claim-detail--compact" : "claim-detail"} aria-label={`${t.selected}: ${claim.title[locale]}`} aria-live="polite">
    <p className="detail-label">{t.selected}</p>
    <h2>{claim.title[locale]}</h2>
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
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [selectedId, setSelectedId] = useState(profile.claims[0].id);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [lifecycle, setLifecycle] = useState("");
  const [tag, setTag] = useState("");
  const [year, setYear] = useState("");
  const [sort, setSort] = useState<"relevant" | "title">("relevant");
  const [menuOpen, setMenuOpen] = useState(false);
  const [discovery, setDiscovery] = useState<DiscoveryState>(emptyDiscoveryState);
  const [storageReady, setStorageReady] = useState(false);
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

  const signal = useCallback((kind: Parameters<typeof applySignal>[1], topics: string[], claimId?: string) => {
    setDiscovery((current) => applySignal(current, kind, topics, claimId));
  }, []);

  const selected = profile.claims.find((claim) => claim.id === selectedId) ?? profile.claims[0];
  useEffect(() => {
    const timer = window.setTimeout(() => signal("dwell", selected.tags, selected.id), 8000);
    return () => window.clearTimeout(timer);
  }, [selected.id, selected.tags, signal]);

  const results = useMemo(() => {
    const searched = searchClaims(profile, query, { type, lifecycle, tag, year });
    if (sort === "title") return [...searched].sort((a, b) => a.claim.title[locale].localeCompare(b.claim.title[locale]));
    if (query || type || lifecycle || tag || year || discovery.signalCount === 0) return searched;
    const order = new Map(rankRecommendations(profile, discovery).map((item, index) => [item.claim.id, index]));
    return [...searched].sort((a, b) => (order.get(a.claim.id) ?? 99) - (order.get(b.claim.id) ?? 99));
  }, [profile, query, type, lifecycle, tag, year, sort, locale, discovery]);

  const visibleIds = new Set(results.map((item) => item.claim.id));
  const tags = [...new Set(profile.claims.flatMap((claim) => claim.tags))].sort();
  const years = [...new Set(profile.evidence.map((item) => item.observedAt.slice(0, 4)))].sort().reverse();
  const selectClaim = (claim: Claim) => { setSelectedId(claim.id); signal("open", claim.tags, claim.id); };
  const moveClaimFocus = (event: KeyboardEvent<HTMLButtonElement>, claim: Claim) => {
    const keys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"];
    if (!keys.includes(event.key) || results.length === 0) return;
    event.preventDefault();
    const current = Math.max(0, results.findIndex((item) => item.claim.id === claim.id));
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? results.length - 1
        : (current + (["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : -1) + results.length) % results.length;
    const next = results[nextIndex].claim;
    selectClaim(next);
    window.requestAnimationFrame(() => document.getElementById(`claim-node-${next.id}`)?.focus());
  };
  const moreLike = () => {
    const next = applySignal(discovery, "more-like-this", selected.tags, selected.id);
    setDiscovery(next);
    const recommendation = rankRecommendations(profile, next, selected.id)[0]?.claim;
    if (recommendation) setSelectedId(recommendation.id);
  };
  const submitSearch = (event: { preventDefault: () => void }) => { event.preventDefault(); signal("search", normalizeTerm(query).split(" ")); };
  const reset = () => {
    setDiscovery(emptyDiscoveryState()); setQuery(""); setType(""); setLifecycle(""); setTag(""); setYear(""); setSort("relevant"); setSelectedId(profile.claims[0].id);
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
        <p className="headline">{locale === "en" ? "Integration & Automation Engineer" : "Ingeniero de Integraciones y Automatización"}</p>
        <p className="intro-copy">{t.explore}</p>
      </section>

      <form className="search-controls" id="search" role="search" onSubmit={submitSearch}>
        <label className="search-field"><span className="sr-only">{t.search}</span><SearchIcon/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.placeholder}/></label>
        <select aria-label={t.allTypes} value={type} onChange={(event) => { setType(event.target.value); if (event.target.value) signal("filter", [event.target.value]); }}><option value="">{t.allTypes}</option>{[...new Set(profile.claims.map((claim) => claim.type))].map((value) => <option key={value} value={value}>{marketLabel(value, locale)}</option>)}</select>
        <select aria-label={t.allStatuses} value={lifecycle} onChange={(event) => { setLifecycle(event.target.value); if (event.target.value) signal("filter", [event.target.value]); }}><option value="">{t.allStatuses}</option>{[...new Set(profile.claims.map((claim) => claim.lifecycle))].map((value) => <option key={value} value={value}>{marketLabel(value, locale)}</option>)}</select>
        <select aria-label={t.allSkills} value={tag} onChange={(event) => { setTag(event.target.value); if (event.target.value) signal("filter", [event.target.value]); }}><option value="">{t.allSkills}</option>{tags.map((value) => <option key={value} value={value}>{marketLabel(value, locale)}</option>)}</select>
        <select aria-label={t.allTime} value={year} onChange={(event) => { setYear(event.target.value); if (event.target.value) signal("filter", [event.target.value]); }}><option value="">{t.allTime}</option>{years.map((value) => <option key={value} value={value}>{value}</option>)}</select>
        <button className="clear-control" type="button" onClick={() => { setQuery(""); setType(""); setLifecycle(""); setTag(""); setYear(""); }}>{t.clear}</button>
      </form>

      <section className="constellation" id="graph" aria-label={locale === "en" ? "Career highlights map" : "Mapa de experiencia profesional"} aria-describedby="graph-help">
        <p className="sr-only" id="graph-help">{t.graphHelp}</p>
        <div className="graph-stage">
          <div className="legend" aria-hidden="true"><span><i className="legend-selected"/>{t.selectedLegend}</span><span><i className="legend-claim"/>{t.otherLegend}</span><span><i className="legend-evidence"/>{t.supportLegend}</span><span><i className="legend-line"/>{t.relationshipLegend}</span></div>
          <svg className="relationship-map" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <line x1="58" y1="31" x2="40" y2="65" className="relation relation--claim"/><line x1="58" y1="31" x2="78" y2="70" className="relation relation--claim"/><line x1="40" y1="65" x2="20" y2="40" className="relation relation--claim"/>
            {profile.claims.map((claim) => { const point = layout[claim.id]; return point ? <line key={claim.id} x1={point.claim[0]} y1={point.claim[1]} x2={point.evidence[0]} y2={point.evidence[1]} className="relation"/> : null; })}
          </svg>
          <div className="claim-graph">
            {profile.claims.map((claim) => {
              const point = layout[claim.id] ?? { claim: [50, 50], evidence: [50, 80] };
              const evidence = evidenceFor(profile, claim);
              const isSelected = claim.id === selected.id;
              const hidden = !visibleIds.has(claim.id);
              const claimStyle = { "--x": `${point.claim[0]}%`, "--y": `${point.claim[1]}%` } as CSSProperties;
              const evidenceStyle = { "--x": `${point.evidence[0]}%`, "--y": `${point.evidence[1]}%` } as CSSProperties;
              return <article key={claim.id} className={`graph-branch${isSelected ? " graph-branch--selected" : ""}${hidden ? " graph-branch--hidden" : ""}`}>
                <button className="claim-node" id={`claim-node-${claim.id}`} data-claim-id={claim.id} style={claimStyle} type="button" aria-pressed={isSelected} disabled={hidden} onKeyDown={(event) => moveClaimFocus(event, claim)} onClick={() => selectClaim(claim)}><span className="node-dot" aria-hidden="true"/><span><strong>{claim.title[locale]}</strong><small>{marketLabel(claim.lifecycle, locale)}{claim.tags.includes("non-ai") ? (locale === "en" ? " · no AI" : " · sin IA") : ""}</small></span></button>
                <div className="evidence-node" style={evidenceStyle}><span className="node-dot"/><span>{marketEvidenceTitle(evidence, locale)}</span></div>
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
