import type { Locale, ResumilioProfile } from "./profile.js";
import { absoluteUrl, classicClaimPath, classicEvidencePath, classicPath, localeRoot } from "./site.js";

function personEntity(profile: ResumilioProfile, locale: Locale) {
  return {
    "@id": absoluteUrl(`${localeRoot(locale)}#person`),
    "@type": "Person",
    name: profile.profile.name[locale],
    description: profile.profile.summary[locale],
    url: absoluteUrl(localeRoot(locale)),
    email: profile.profile.contacts.find((item) => item.kind === "email")?.url.replace("mailto:", ""),
    sameAs: profile.profile.contacts.filter((item) => item.kind !== "email").map((item) => item.url),
  };
}

export function buildProfileJsonLd(profile: ResumilioProfile, locale: Locale) {
  const pageUrl = absoluteUrl(localeRoot(locale));
  const person = personEntity(profile, locale);
  return {
    "@context": "https://schema.org",
    "@graph": [
      { "@id": pageUrl, "@type": "ProfilePage", url: pageUrl, name: profile.profile.name[locale], inLanguage: locale, mainEntity: { "@id": person["@id"] } },
      { ...person, subjectOf: profile.claims.map((claim) => ({ "@id": absoluteUrl(classicClaimPath(claim.id, locale)) })) },
      ...profile.claims.map((claim) => ({
        "@id": absoluteUrl(classicClaimPath(claim.id, locale)),
        "@type": claim.id === "claim-masglo-commercial-proposal" ? ["CreativeWork", "SoftwareSourceCode"] : "CreativeWork",
        identifier: claim.id,
        name: claim.title[locale],
        description: claim.summary[locale],
        url: absoluteUrl(classicClaimPath(claim.id, locale)),
        inLanguage: locale,
        creativeWorkStatus: claim.lifecycle,
      })),
    ],
  };
}

export function buildClaimJsonLd(profile: ResumilioProfile, claim: ResumilioProfile["claims"][number], locale: Locale) {
  const pageUrl = absoluteUrl(classicPath(locale));
  const claimUrl = absoluteUrl(classicClaimPath(claim.id, locale));
  const person = personEntity(profile, locale);
  const organization = claim.organizationId ? profile.organizations.find((item) => item.id === claim.organizationId) : undefined;
  const evidence = claim.evidenceIds.map((id) => profile.evidence.find((item) => item.id === id)!);
  const claimEntity: Record<string, unknown> = {
    "@id": claimUrl,
    "@type": claim.id === "claim-masglo-commercial-proposal" ? ["CreativeWork", "SoftwareSourceCode"] : "CreativeWork",
    identifier: claim.id,
    name: claim.title[locale],
    description: claim.summary[locale],
    url: claimUrl,
    inLanguage: locale,
    creativeWorkStatus: claim.lifecycle,
    creator: { "@id": person["@id"] },
    citation: evidence.map((item) => ({ "@id": absoluteUrl(classicEvidencePath(item.id, locale)) })),
    isPartOf: { "@id": pageUrl },
  };
  const repository = evidence.find((item) => item.evidenceType === "repository" && item.source.url)?.source.url;
  if (repository) claimEntity.codeRepository = repository;
  if (organization) claimEntity.sourceOrganization = { "@id": `${pageUrl}#${organization.id}` };
  return {
    "@context": "https://schema.org",
    "@graph": [
      { "@id": pageUrl, "@type": "ProfilePage", url: pageUrl, name: claim.title[locale], inLanguage: locale, mainEntity: { "@id": person["@id"] }, about: { "@id": claimUrl } },
      { ...person, subjectOf: { "@id": claimUrl } },
      claimEntity,
      ...(organization ? [{ "@id": `${pageUrl}#${organization.id}`, "@type": "Organization", name: organization.name[locale], url: organization.url }] : []),
      ...evidence.map((item) => ({
        "@id": absoluteUrl(classicEvidencePath(item.id, locale)),
        "@type": "CreativeWork",
        identifier: item.id,
        name: item.title[locale],
        description: item.source.label[locale],
        dateModified: item.observedAt,
        url: item.source.url ?? absoluteUrl(classicEvidencePath(item.id, locale)),
        isPartOf: { "@id": pageUrl },
      })),
    ],
  };
}
