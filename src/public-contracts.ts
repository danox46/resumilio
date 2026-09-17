import type { Locale, ResumilioProfile } from "./profile.js";
import { absoluteUrl, classicClaimPath, classicEvidencePath, localeRoot, localizedPath, siteOrigin } from "./site.js";

const schemaVersion = "1.0.0" as const;
const publicCache = "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400";

function organizationFor(profile: ResumilioProfile, organizationId?: string) {
  return organizationId ? profile.organizations.find((item) => item.id === organizationId) : undefined;
}

export function responseHeaders(locale: Locale, contentType: string): Headers {
  return new Headers({
    "cache-control": publicCache,
    "content-language": locale,
    "content-type": contentType,
    "x-content-type-options": "nosniff",
  });
}

export function jsonResponse(value: unknown, locale: Locale): Response {
  return new Response(`${JSON.stringify(value, null, 2)}\n`, { headers: responseHeaders(locale, "application/json; charset=utf-8") });
}

export function textResponse(value: string, locale: Locale, contentType = "text/plain; charset=utf-8"): Response {
  return new Response(value.endsWith("\n") ? value : `${value}\n`, { headers: responseHeaders(locale, contentType) });
}

export function buildResumeExport(profile: ResumilioProfile, locale: Locale) {
  return {
    schemaVersion,
    kind: "resumilio-resume",
    locale,
    canonicalUrl: absoluteUrl(localeRoot(locale)),
    profile: {
      id: profile.profile.id,
      name: profile.profile.name[locale],
      headline: profile.profile.headline[locale],
      summary: profile.profile.summary[locale],
      contacts: profile.profile.contacts.map((contact) => ({ id: contact.id, kind: contact.kind, label: contact.label[locale], url: contact.url })),
    },
    claims: profile.claims.map((claim) => {
      const organization = organizationFor(profile, claim.organizationId);
      return {
        id: claim.id,
        type: claim.type,
        lifecycle: claim.lifecycle,
        title: claim.title[locale],
        summary: claim.summary[locale],
        url: absoluteUrl(classicClaimPath(claim.id, locale)),
        organization: organization ? { id: organization.id, name: organization.name[locale], url: organization.url } : undefined,
        tags: claim.tags,
        evidence: claim.evidenceIds.map((evidenceId) => {
          const evidence = profile.evidence.find((item) => item.id === evidenceId)!;
          return {
            id: evidence.id,
            title: evidence.title[locale],
            strength: evidence.strength,
            visibility: evidence.source.visibility,
            url: absoluteUrl(classicEvidencePath(evidence.id, locale)),
            sourceUrl: evidence.source.url,
          };
        }),
      };
    }),
  };
}

export function buildEvidenceExport(profile: ResumilioProfile, locale: Locale) {
  return {
    schemaVersion,
    kind: "resumilio-evidence",
    locale,
    canonicalUrl: absoluteUrl(localizedPath("/evidence.json", locale)),
    evidence: profile.evidence.map((item) => ({
      id: item.id,
      title: item.title[locale],
      evidenceType: item.evidenceType,
      strength: item.strength,
      lifecycle: item.lifecycle,
      observedAt: item.observedAt,
      source: { label: item.source.label[locale], visibility: item.source.visibility, url: item.source.url },
      claims: item.claimIds.map((claimId) => ({ id: claimId, url: absoluteUrl(classicClaimPath(claimId, locale)) })),
    })),
  };
}

export function buildGraphExport(profile: ResumilioProfile, locale: Locale) {
  const nodes = [
    { id: profile.profile.id, kind: "person", label: profile.profile.name[locale], url: absoluteUrl(localeRoot(locale)) },
    ...profile.organizations.map((item) => ({ id: item.id, kind: "organization", label: item.name[locale], url: item.url })),
    ...profile.claims.map((item) => ({ id: item.id, kind: "claim", label: item.title[locale], url: absoluteUrl(classicClaimPath(item.id, locale)) })),
    ...profile.evidence.map((item) => ({ id: item.id, kind: "evidence", label: item.title[locale], url: absoluteUrl(classicEvidencePath(item.id, locale)) })),
  ];
  const supports = profile.evidence.flatMap((item) => item.claimIds.map((claimId) => ({
    id: `support-${item.id}-${claimId}`,
    type: "supports",
    sourceId: item.id,
    targetId: claimId,
  })));
  return {
    schemaVersion,
    kind: "resumilio-graph",
    locale,
    canonicalUrl: absoluteUrl(localizedPath("/graph.json", locale)),
    nodes,
    edges: [...profile.relationships, ...supports],
  };
}

export function buildSearchIndex(profile: ResumilioProfile, locale: Locale) {
  return {
    schemaVersion,
    kind: "resumilio-search-index",
    locale,
    canonicalUrl: absoluteUrl(localizedPath("/search-index.json", locale)),
    documents: profile.claims.map((claim) => {
      const evidence = claim.evidenceIds.map((id) => profile.evidence.find((item) => item.id === id)!);
      const organization = organizationFor(profile, claim.organizationId);
      return {
        id: claim.id,
        title: claim.title[locale],
        summary: claim.summary[locale],
        type: claim.type,
        lifecycle: claim.lifecycle,
        tags: claim.tags,
        organization: organization?.name[locale],
        evidence: evidence.map((item) => item.title[locale]),
        url: absoluteUrl(classicClaimPath(claim.id, locale)),
      };
    }),
  };
}

export function buildDiscoveryManifest(profile: ResumilioProfile) {
  const endpoints = (locale: Locale) => ({
    resume: absoluteUrl(localizedPath("/resume.json", locale)),
    evidence: absoluteUrl(localizedPath("/evidence.json", locale)),
    graph: absoluteUrl(localizedPath("/graph.json", locale)),
    searchIndex: absoluteUrl(localizedPath("/search-index.json", locale)),
    llms: absoluteUrl(localizedPath("/llms.txt", locale)),
    llmsFull: absoluteUrl(localizedPath("/llms-full.txt", locale)),
  });
  return {
    schemaVersion,
    kind: "resumilio-discovery",
    protocol: "https://github.com/danox46/resumilio/blob/main/docs/machine-interfaces.md",
    profileId: profile.profile.id,
    defaultLocale: profile.profile.defaultLocale,
    locales: { en: endpoints("en"), es: endpoints("es") },
    schemas: {
      profile: absoluteUrl("/schemas/profile.v1.schema.json"),
      resume: absoluteUrl("/schemas/resume.v1.schema.json"),
      evidence: absoluteUrl("/schemas/evidence.v1.schema.json"),
      graph: absoluteUrl("/schemas/graph.v1.schema.json"),
      searchIndex: absoluteUrl("/schemas/search-index.v1.schema.json"),
      discovery: absoluteUrl("/schemas/discovery.v1.schema.json"),
    },
    capabilities: ["profile", "evidence", "graph", "search", "schema", "citation"],
    citation: { claimUrlField: "claims[].url", evidenceUrlField: "claims[].evidence[].url", maximumResolutionHops: 1 },
    mcp: {
      transport: "stdio",
      command: "resumilio-mcp",
      tools: ["profile_read", "profile_update_claim", "source_link", "claims_validate", "preview_build", "deployment_artifacts_build"],
    },
  };
}

export function buildLlmsText(profile: ResumilioProfile, locale: Locale, full = false): string {
  const t = locale === "en" ? {
    evidence: "Evidence-backed public work profile", interfaces: "Machine interfaces", claims: "Verified public claims", source: "Source",
  } : {
    evidence: "Perfil público de trabajo respaldado por evidencia", interfaces: "Interfaces para máquinas", claims: "Afirmaciones públicas verificadas", source: "Fuente",
  };
  const endpoints = buildDiscoveryManifest(profile).locales[locale];
  const lines = [
    `# ${profile.profile.name[locale]}`,
    "",
    `> ${t.evidence}. ${profile.profile.headline[locale]}.`,
    "",
    `## ${t.interfaces}`,
    "",
    `- Resume: ${endpoints.resume}`,
    `- Evidence: ${endpoints.evidence}`,
    `- Graph: ${endpoints.graph}`,
    `- Search index: ${endpoints.searchIndex}`,
    `- Discovery: ${siteOrigin}/.well-known/resumilio.json`,
    "",
    `## ${t.claims}`,
    "",
  ];
  for (const claim of profile.claims) {
    lines.push(`- [${claim.title[locale]}](${absoluteUrl(classicClaimPath(claim.id, locale))}) — ${claim.lifecycle}`);
    if (full) {
      lines.push(`  ${claim.summary[locale]}`);
      for (const evidenceId of claim.evidenceIds) {
        const evidence = profile.evidence.find((item) => item.id === evidenceId)!;
        lines.push(`  - ${t.source}: [${evidence.title[locale]}](${absoluteUrl(classicEvidencePath(evidence.id, locale))}) — ${evidence.strength}; ${evidence.source.visibility}`);
      }
    }
  }
  return `${lines.join("\n")}\n`;
}
