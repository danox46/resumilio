import { useEffect, useMemo, useRef, useState } from "react";
import type { ResumilioConfig, ResumilioProfile, ResourceKind } from "../core/profile.js";
import { localized } from "../core/profile.js";
import { recommendations } from "../core/graph.js";
import { Companion, type CompanionMood } from "./Companion.js";

export interface ConstellationProps {
  profile: ResumilioProfile;
  config: ResumilioConfig;
  locale?: string;
  classicBase?: string;
}

const desktopSlots = [
  { x: 18, y: 25 }, { x: 75, y: 17 }, { x: 84, y: 64 }, { x: 31, y: 78 }, { x: 56, y: 87 },
];
const mobileSlots = [{ x: 82, y: 14 }, { x: 14, y: 14 }, { x: 84, y: 90 }, { x: 16, y: 90 }];
const companionReactionMs = 5800;

const resourceLabels: Record<ResourceKind, Record<string, string>> = {
  "live-demo": { en: "Live demo", es: "Demo en vivo" },
  "external-preview": { en: "External preview", es: "Vista externa" },
  "public-repository": { en: "Public repository", es: "Repositorio público" },
  "online-certificate": { en: "Online certificate", es: "Certificado en línea" },
  "work-sample": { en: "Work sample", es: "Muestra de trabajo" },
  "nda-protected": { en: "NDA protected", es: "Protegido por NDA" },
};

export function Constellation({ profile, config, locale = profile.profile.defaultLocale, classicBase = "/classic/" }: ConstellationProps) {
  const fallback = profile.profile.defaultLocale;
  const [centerId, setCenterId] = useState(profile.careerItems[0]?.id ?? "");
  const [visited, setVisited] = useState<string[]>([]);
  const [limit, setLimit] = useState(config.presentation.activeNodes.desktop);
  const [query, setQuery] = useState("");
  const [mood, setMood] = useState<CompanionMood>("idle");
  const waitTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const reactionTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const media = matchMedia("(max-width: 700px)");
    const update = () => setLimit(media.matches ? config.presentation.activeNodes.mobile : config.presentation.activeNodes.desktop);
    update(); media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [config.presentation.activeNodes]);

  useEffect(() => {
    clearTimeout(waitTimer.current);
    waitTimer.current = setTimeout(() => setMood("waiting"), 24000);
    return () => clearTimeout(waitTimer.current);
  }, [centerId]);

  useEffect(() => () => clearTimeout(reactionTimer.current), []);

  const center = profile.careerItems.find((item) => item.id === centerId) ?? profile.careerItems[0];
  const visibleIds = useMemo(() => recommendations(profile, center.id, limit, visited), [profile, center.id, limit, visited]);
  const visible = visibleIds.map((id) => profile.careerItems.find((item) => item.id === id)!).filter(Boolean);
  const slots = limit <= 4 ? mobileSlots : desktopSlots;
  const organization = profile.organizations.find((item) => item.id === center.organizationId);
  const resources = center.resourceIds.map((id) => profile.resources.find((item) => item.id === id)).filter(Boolean) as ResumilioProfile["resources"];
  const primaryResource = resources.find((item) => item.availability === "public") ?? resources[0];
  const ghostIds = visible.flatMap((item) => recommendations(profile, item.id, 2, [...visited, center.id, ...visibleIds])).filter((id, index, all) => id !== center.id && !visibleIds.includes(id) && all.indexOf(id) === index).slice(0, 8);

  const select = (id: string, reaction: CompanionMood = "guide") => {
    setVisited((current) => [...new Set([...current, center.id])]);
    setMood(reaction);
    setCenterId(id);
    clearTimeout(reactionTimer.current);
    reactionTimer.current = window.setTimeout(() => setMood("idle"), companionReactionMs);
  };

  const submitSearch = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = query.trim().toLowerCase();
    const match = profile.careerItems.find((item) => [localized(item.title, locale, fallback), localized(item.summary, locale, fallback), ...item.tags].join(" ").toLowerCase().includes(normalized));
    if (match) select(match.id, "smile");
  };

  return (
    <section className="constellation" style={{ "--constellation-accent": config.presentation.palette.accent } as React.CSSProperties}>
      <form className="constellation-search" onSubmit={submitSearch} role="search">
        <label className="sr-only" htmlFor="constellation-query">{locale === "es" ? "Buscar experiencia" : "Search experience"}</label>
        <input id="constellation-query" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={locale === "es" ? "Buscar roles, habilidades o proyectos" : "Search roles, skills, or projects"} />
        <button type="submit" aria-label={locale === "es" ? "Buscar" : "Search"}>⌕</button>
      </form>
      <div className="constellation-stage">
        <Companion enabled={config.presentation.companion.enabled} mood={mood} />
        <svg className="constellation-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {visible.map((item, index) => <line key={item.id} x1="50" y1="49" x2={slots[index]?.x ?? 50} y2={slots[index]?.y ?? 50} />)}
        </svg>
        {ghostIds.map((id, index) => <span key={id} className="reserve-node" style={{ left: `${8 + ((index * 23) % 86)}%`, top: `${10 + ((index * 31) % 78)}%` }} aria-hidden="true" />)}
        {visible.map((item, index) => (
          <button className="preview-node" key={item.id} style={{ left: `${slots[index]?.x ?? 50}%`, top: `${slots[index]?.y ?? 50}%` }} onClick={() => select(item.id)}>
            <span>{localized(item.title, locale, fallback)}</span>
          </button>
        ))}
        <article className="focus-node" key={center.id}>
          <h2>{localized(center.title, locale, fallback)}</h2>
          {organization && <p className="focus-organization">{localized(organization.name, locale, fallback)}</p>}
          {primaryResource && <a className={`resource-link resource-link--${primaryResource.kind}`} href={primaryResource.url ?? undefined} target={primaryResource.url ? "_blank" : undefined} rel="noreferrer">{resourceLabels[primaryResource.kind][locale] ?? resourceLabels[primaryResource.kind].en}</a>}
          <p>{localized(center.summary, locale, fallback)}</p>
        </article>
      </div>
      <nav className="constellation-actions" aria-label={locale === "es" ? "Acciones de currículum" : "Resume actions"}>
        <a href={`${classicBase}#${center.id}`}>{locale === "es" ? "Vista clásica" : "Classic View"}</a>
        <button onClick={() => visible[0] && select(visible[0].id, "smile")}>{locale === "es" ? "Trabajo similar" : "Similar Work"}</button>
        {profile.profile.contacts[0] && <a href={profile.profile.contacts[0].url}>{localized(profile.profile.contacts[0].label, locale, fallback)}</a>}
      </nav>
    </section>
  );
}
