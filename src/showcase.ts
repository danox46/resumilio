import type { Locale, ResumilioProfile } from "./profile.js";

type Claim = ResumilioProfile["claims"][number];
type Evidence = ResumilioProfile["evidence"][number];

export type ShowcaseKind =
  | "professional-role"
  | "live-demo"
  | "public-source"
  | "external-preview"
  | "certificate"
  | "nda-protected"
  | "private-context";

export interface ClaimShowcase {
  kind: ShowcaseKind;
  label: string;
  href?: string;
}

const labels: Record<Locale, Record<ShowcaseKind, string>> = {
  en: {
    "professional-role": "Professional role",
    "live-demo": "Live demo",
    "public-source": "Public source",
    "external-preview": "External preview",
    certificate: "Certificate online",
    "nda-protected": "NDA protected",
    "private-context": "Private work context",
  },
  es: {
    "professional-role": "Rol profesional",
    "live-demo": "Demo en vivo",
    "public-source": "Código público",
    "external-preview": "Vista externa",
    certificate: "Certificado en línea",
    "nda-protected": "Protegido por NDA",
    "private-context": "Contexto de trabajo privado",
  },
};

const showcaseWeights: Record<ShowcaseKind, number> = {
  "professional-role": .8,
  "live-demo": .68,
  "public-source": .58,
  "external-preview": .5,
  certificate: .46,
  "nda-protected": .22,
  "private-context": .14,
};

function claimEvidence(profile: ResumilioProfile, claim: Claim): Evidence[] {
  const ids = new Set(claim.evidenceIds);
  return profile.evidence.filter((item) => ids.has(item.id));
}

function publicUrl(item: Evidence): string | undefined {
  return item.lifecycle === "available" && item.source.visibility === "public" ? item.source.url : undefined;
}

function looksLikeLiveDemo(item: Evidence): boolean {
  const url = publicUrl(item);
  if (!url) return false;
  const hostname = new URL(url).hostname.toLowerCase();
  const label = `${item.source.label.en} ${item.source.label.es}`.toLowerCase();
  return hostname.endsWith("itch.io")
    || /\b(live|demo|release|download|public site|sitio publico|sitio público)\b/.test(label);
}

export function claimShowcaseKind(profile: ResumilioProfile, claim: Claim): ShowcaseKind {
  return claimShowcases(profile, claim, "en")[0].kind;
}

export function claimShowcases(profile: ResumilioProfile, claim: Claim, locale: Locale): ClaimShowcase[] {
  const records = claimEvidence(profile, claim);
  const publicRecords = records.filter((item) => publicUrl(item));
  const result: ClaimShowcase[] = [];
  const usedIds = new Set<string>();
  const add = (kind: ShowcaseKind, item?: Evidence) => {
    result.push({ kind, label: labels[locale][kind], href: item ? publicUrl(item) : undefined });
    if (item) usedIds.add(item.id);
  };

  const roleProfile = claim.type === "experience"
    ? publicRecords.find((item) => item.evidenceType === "public-source" && publicUrl(item)?.includes("linkedin.com/"))
    : undefined;
  if (roleProfile) add("professional-role", roleProfile);

  const certificate = claim.type === "certification" ? publicRecords[0] : undefined;
  if (certificate) add("certificate", certificate);

  const liveDemo = publicRecords.find((item) => !usedIds.has(item.id) && looksLikeLiveDemo(item));
  if (liveDemo) add("live-demo", liveDemo);

  const repository = publicRecords.find((item) => !usedIds.has(item.id) && item.evidenceType === "repository");
  if (repository) add("public-source", repository);

  const externalPreview = publicRecords.find((item) => !usedIds.has(item.id));
  if (externalPreview) add("external-preview", externalPreview);

  if (claim.tags.includes("nda-protected")) add("nda-protected");
  if (!result.length) add("private-context");
  return result;
}

export function claimShowcase(profile: ResumilioProfile, claim: Claim, locale: Locale): ClaimShowcase {
  return claimShowcases(profile, claim, locale)[0];
}

export function showcaseRecommendationWeight(profile: ResumilioProfile, claim: Claim): number {
  return showcaseWeights[claimShowcaseKind(profile, claim)];
}
