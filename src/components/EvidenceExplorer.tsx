import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { applySignal, emptyDiscoveryState, normalizeTerm, rankRecommendations, recommendationReason, searchClaims, type DiscoveryState } from "../discovery.js";
import type { Locale, ResumilioProfile } from "../profile.js";
import { claimPath } from "../site.js";

const sessionKey = "resumilio:discovery:v1";
type Claim = ResumilioProfile["claims"][number];

const copy = {
  en: {
    evidence: "Evidence", graph: "Graph", search: "Search", explore: "Explore the evidence behind the work.",
    placeholder: "Search skills, projects, and evidence", allTypes: "All types", allStatuses: "All statuses",
    allSkills: "All skills", allTime: "All time", clear: "Clear filters", selected: "Selected claim", lifecycle: "Lifecycle",
    strength: "Evidence strength", visibility: "Source visibility", recommended: "Recommended because",
    view: "View evidence", more: "More like this", results: "results", allEvidence: "All evidence",
    listIntro: "A searchable list of claims and evidence related to Daniel's work.", type: "Type", status: "Status",
    keyEvidence: "Key evidence", reset: "Reset this session", powered: "Powered by Resumilio", menu: "Open navigation",
    empty: "No evidence matches this search.", publicSummary: "Public summary · underlying material restricted", sortBy: "Sort by", relevant: "Most relevant", titleAsc: "Title A–Z",
  },
  es: {
    evidence: "Evidencia", graph: "Grafo", search: "Buscar", explore: "Explora la evidencia detrás del trabajo.",
    placeholder: "Busca habilidades, proyectos y evidencia", allTypes: "Todos los tipos", allStatuses: "Todos los estados",
    allSkills: "Todas las habilidades", allTime: "Todo el tiempo", clear: "Limpiar filtros", selected: "Afirmación seleccionada", lifecycle: "Ciclo de vida",
    strength: "Solidez de la evidencia", visibility: "Visibilidad de la fuente", recommended: "Recomendado porque",
    view: "Ver evidencia", more: "Más como esto", results: "resultados", allEvidence: "Toda la evidencia",
    listIntro: "Una lista consultable de afirmaciones y evidencia sobre el trabajo de Daniel.", type: "Tipo", status: "Estado",
    keyEvidence: "Evidencia clave", reset: "Reiniciar esta sesión", powered: "Creado con Resumilio", menu: "Abrir navegación",
    empty: "Ninguna evidencia coincide con esta búsqueda.", publicSummary: "Resumen público · material subyacente restringido", sortBy: "Ordenar por", relevant: "Más relevante", titleAsc: "Título A–Z",
  },
} as const;

const layout: Record<string, { claim: [number, number]; evidence: [number, number] }> = {
  "claim-professional-ai-text-completion": { claim: [58, 31], evidence: [62, 9] },
  "claim-hubspot-sms-app": { claim: [40, 65], evidence: [40, 88] },
  "claim-masglo-commercial-proposal": { claim: [20, 40], evidence: [8, 28] },
  "claim-google-cloud-big-data-course": { claim: [78, 70], evidence: [80, 91] },
};

function contractLabel(value: string, locale: Locale): string {
  const labels: Record<Locale, Record<string, string>> = {
    en: {
      experience: "Experience", project: "Project", education: "Education", certification: "Certification", publication: "Publication", skill: "Skill",
      "working-prelaunch": "Working prelaunch", shipped: "Shipped", proposal: "Proposal", completed: "Completed", production: "Production", idea: "Idea", retired: "Retired",
      "self-attested": "Self-attested", corroborated: "Corroborated", primary: "Primary",
    },
    es: {
      experience: "Experiencia", project: "Proyecto", education: "Educación", certification: "Certificación", publication: "Publicación", skill: "Habilidad",
      "working-prelaunch": "Funcional antes del lanzamiento", shipped: "Entregado", proposal: "Propuesta", completed: "Completado", production: "Producción", idea: "Idea", retired: "Retirado",
      "self-attested": "Declaración propia", corroborated: "Corroborada", primary: "Primaria",
    },
  };
  return labels[locale][value] ?? `${value.charAt(0).toUpperCase()}${value.slice(1).replaceAll("-", " ")}`;
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

function ClaimDetail({ profile, claim, locale, state, compact = false, onMoreLike }: {
  profile: ResumilioProfile; claim: Claim; locale: Locale; state: DiscoveryState; compact?: boolean; onMoreLike: () => void;
}) {
  const t = copy[locale];
  const evidence = evidenceFor(profile, claim);
  const reason = recommendationReason(state, locale).replace(locale === "es" ? "Recomendado porque " : "Recommended because ", "");
  const visibility = evidence.source.visibility === "public" ? evidence.source.label[locale] : t.publicSummary;
  return <section className={compact ? "claim-detail claim-detail--compact" : "claim-detail"} aria-label={`${t.selected}: ${claim.title[locale]}`} aria-live="polite">
    <p className="detail-label">{t.selected}</p>
    <h2>{claim.title[locale]}</h2>
    <p className="detail-status">{contractLabel(claim.lifecycle, locale)}</p>
    <p className="detail-summary">{claim.summary[locale]}</p>
    <dl>
      <div><dt>{t.lifecycle}</dt><dd>{contractLabel(claim.lifecycle, locale)}</dd></div>
      <div><dt>{t.strength}</dt><dd>{contractLabel(evidence.strength, locale)}</dd></div>
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
      <nav className={menuOpen ? "primary-nav primary-nav--open" : "primary-nav"} aria-label="Primary">
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
        <p className="intro-copy">{t.explore}</p>
      </section>

      <form className="search-controls" id="search" role="search" onSubmit={submitSearch}>
        <label className="search-field"><span className="sr-only">{t.search}</span><SearchIcon/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.placeholder}/></label>
        <select aria-label={t.allTypes} value={type} onChange={(event) => { setType(event.target.value); if (event.target.value) signal("filter", [event.target.value]); }}><option value="">{t.allTypes}</option>{[...new Set(profile.claims.map((claim) => claim.type))].map((value) => <option key={value} value={value}>{contractLabel(value, locale)}</option>)}</select>
        <select aria-label={t.allStatuses} value={lifecycle} onChange={(event) => { setLifecycle(event.target.value); if (event.target.value) signal("filter", [event.target.value]); }}><option value="">{t.allStatuses}</option>{[...new Set(profile.claims.map((claim) => claim.lifecycle))].map((value) => <option key={value} value={value}>{contractLabel(value, locale)}</option>)}</select>
        <select aria-label={t.allSkills} value={tag} onChange={(event) => { setTag(event.target.value); if (event.target.value) signal("filter", [event.target.value]); }}><option value="">{t.allSkills}</option>{tags.map((value) => <option key={value} value={value}>{contractLabel(value, locale)}</option>)}</select>
        <select aria-label={t.allTime} value={year} onChange={(event) => { setYear(event.target.value); if (event.target.value) signal("filter", [event.target.value]); }}><option value="">{t.allTime}</option>{years.map((value) => <option key={value} value={value}>{value}</option>)}</select>
        <button className="clear-control" type="button" onClick={() => { setQuery(""); setType(""); setLifecycle(""); setTag(""); setYear(""); }}>{t.clear}</button>
      </form>

      <section className="constellation" id="graph" aria-label="Evidence constellation">
        <div className="graph-stage">
          <div className="legend" aria-hidden="true"><span><i className="legend-selected"/>Selected claim</span><span><i className="legend-claim"/>Other claim</span><span><i className="legend-evidence"/>Evidence / source</span><span><i className="legend-line"/>Relationship</span></div>
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
                <button className="claim-node" style={claimStyle} type="button" aria-pressed={isSelected} onClick={() => selectClaim(claim)}><span className="node-dot"/><span><strong>{claim.title[locale]}</strong><small>{contractLabel(claim.lifecycle, locale)}{claim.tags.includes("non-ai") ? " · non-AI" : ""}</small></span></button>
                <div className="evidence-node" style={evidenceStyle}><span className="node-dot"/><span>{evidence.title[locale]}</span></div>
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
          <div className="evidence-row evidence-row--header" role="row"><span role="columnheader">Title</span><span role="columnheader">{t.type}</span><span role="columnheader">{t.status}</span><span role="columnheader">{t.keyEvidence}</span><span role="columnheader">{t.strength}</span><span/></div>
          {results.map(({ claim }) => { const evidence = evidenceFor(profile, claim); return <article className="evidence-row" role="row" id={claim.id} key={claim.id} onClick={() => selectClaim(claim)}>
            <a role="cell" href={claimPath(claim.id, locale)} onClick={(event) => { event.stopPropagation(); signal("open", claim.tags, claim.id); }}>{claim.title[locale]}</a><span role="cell">{contractLabel(claim.type, locale)}</span><span role="cell">{contractLabel(claim.lifecycle, locale)}{claim.tags.includes("non-ai") ? " · non-AI" : ""}</span><span role="cell" id={evidence.id}>{evidence.source.url ? <a href={evidence.source.url} target="_blank" rel="noreferrer" onClick={() => signal("source-visit", claim.tags, claim.id)}>{evidence.title[locale]}</a> : evidence.title[locale]}</span><span role="cell">{contractLabel(evidence.strength, locale)}</span><Chevron/></article>; })}
        </div>
      </section>
    </main>

    <footer><span>{t.powered}</span><button className="reset-control reset-control--mobile" type="button" onClick={reset}><ResetIcon/>{t.reset}</button><a className="locale-control" href={locale === "en" ? "/es/" : "/"} onClick={(event) => { event.preventDefault(); setLocale(locale === "en" ? "es" : "en"); }}><strong>EN</strong><span>/</span><strong>ES</strong></a></footer>
  </div>;
}
