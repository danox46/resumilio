import type { ResumilioProfile } from "../core/profile.js";
import { localized } from "../core/profile.js";

export function ClassicResume({ profile, locale = profile.profile.defaultLocale }: { profile: ResumilioProfile; locale?: string }) {
  const fallback = profile.profile.defaultLocale;
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
          <summary><h2>{kind.replace("-", " ")}</h2><span>{items.length}</span></summary>
          <div className="classic-section">
            {items.map((item) => {
              const organization = profile.organizations.find((entry) => entry.id === item.organizationId);
              return <article id={item.id} key={item.id}>
                <h3>{localized(item.title, locale, fallback)}</h3>
                {organization && <p className="classic-meta">{localized(organization.name, locale, fallback)}</p>}
                <p>{localized(item.summary, locale, fallback)}</p>
              </article>;
            })}
          </div>
        </details>
      ))}
    </main>
  );
}
