import type { ResumilioProfile } from "../core/profile.js";
import { localized } from "../core/profile.js";

export function ClassicResume({ profile, locale = profile.profile.defaultLocale }: { profile: ResumilioProfile; locale?: string }) {
  const fallback = profile.profile.defaultLocale;
  const spanish = locale.toLowerCase().startsWith("es");
  const sectionNames: Record<string, [string, string]> = {
    role: ["Experience", "Experiencia"],
    project: ["Projects", "Proyectos"],
    education: ["Education", "Educación"],
    certification: ["Certifications", "Certificaciones"],
    publication: ["Publications", "Publicaciones"],
    skill: ["Skills", "Habilidades"],
  };
  const resourceNames: Record<string, [string, string]> = {
    "live-demo": ["Live demo", "Demo en vivo"],
    "external-preview": ["External preview", "Vista externa"],
    "public-repository": ["Public repository", "Repositorio público"],
    "online-certificate": ["Online certificate", "Certificado en línea"],
    "work-sample": ["Work sample", "Muestra de trabajo"],
    "nda-protected": ["NDA protected", "Protegido por acuerdo de confidencialidad"],
    "career-note": ["Career note", "Nota profesional"],
  };
  const groups = new Map<string, ResumilioProfile["careerItems"]>();
  for (const item of profile.careerItems) groups.set(item.kind, [...(groups.get(item.kind) ?? []), item]);
  return (
    <main className="classic-resume">
      <header>
        <h1>{localized(profile.profile.name, locale, fallback)}</h1>
        <p className="classic-headline">{localized(profile.profile.headline, locale, fallback)}</p>
        <p>{localized(profile.profile.summary, locale, fallback)}</p>
        <nav>{profile.profile.contacts.map((contact) => <a key={contact.id} href={contact.url}>{localized(contact.label, locale, fallback)}</a>)}</nav>
      </header>
      {[...groups.entries()].map(([kind, items]) => (
        <details key={kind} open={kind === "role" || kind === "project"}>
          <summary><h2>{sectionNames[kind]?.[spanish ? 1 : 0] ?? kind.replace("-", " ")}</h2><span>{items.length}</span></summary>
          <div className="classic-section">
            {items.map((item) => {
              const organization = profile.organizations.find((entry) => entry.id === item.organizationId);
              const resources = item.resourceIds
                .map((id) => profile.resources.find((entry) => entry.id === id))
                .filter((resource): resource is ResumilioProfile["resources"][number] => Boolean(resource));
              const dates = [item.startDate, item.endDate ?? (item.state === "current" && item.startDate ? (spanish ? "Actualidad" : "Present") : undefined)]
                .filter(Boolean).join(" – ");
              return <article id={item.id} key={item.id}>
                <div className="classic-entry-heading"><h3>{localized(item.title, locale, fallback)}</h3><a className="classic-permalink" href={`#${item.id}`} aria-label={`${spanish ? "Enlace a" : "Link to"} ${localized(item.title, locale, fallback)}`}>#</a></div>
                {(organization || dates) && <p className="classic-meta">{organization && localized(organization.name, locale, fallback)}{organization && dates && <span aria-hidden="true"> · </span>}{dates && <span>{dates}</span>}</p>}
                <p>{localized(item.summary, locale, fallback)}</p>
                {item.tags.length > 0 && <ul className="classic-tags" aria-label={spanish ? "Temas" : "Topics"}>{item.tags.map((tag) => <li key={tag}>{tag}</li>)}</ul>}
                {resources.length > 0 && <ul className="classic-resources" aria-label={spanish ? "Enlaces y disponibilidad" : "Links and availability"}>{resources.map((resource) => <li key={resource.id}>
                  {resource.availability === "public" && resource.url
                    ? <a href={resource.url} target="_blank" rel="noopener noreferrer">{resourceNames[resource.kind]?.[spanish ? 1 : 0] ?? localized(resource.label, locale, fallback)}: {localized(resource.label, locale, fallback)}</a>
                    : <span>{resourceNames[resource.kind]?.[spanish ? 1 : 0] ?? localized(resource.label, locale, fallback)}: {localized(resource.label, locale, fallback)}</span>}
                </li>)}</ul>}
              </article>;
            })}
          </div>
        </details>
      ))}
    </main>
  );
}
