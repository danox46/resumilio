export type Locale = "en" | "es";
export type LocalizedText = Record<Locale, string>;

export interface ResumilioProfile {
  schemaVersion: "1.0.0";
  profile: {
    id: string;
    name: LocalizedText;
    headline: LocalizedText;
    summary: LocalizedText;
    defaultLocale: Locale;
    locales: Locale[];
    contacts: Array<{
      id: string;
      kind: "github" | "linkedin" | "portfolio" | "email";
      label: LocalizedText;
      url: string;
    }>;
  };
  organizations: Array<{
    id: string;
    name: LocalizedText;
    url?: string;
  }>;
  claims: Array<{
    id: string;
    type: "experience" | "project" | "education" | "certification" | "publication" | "skill";
    lifecycle: "idea" | "proposal" | "working-prelaunch" | "shipped" | "production" | "completed" | "retired";
    title: LocalizedText;
    summary: LocalizedText;
    organizationId?: string;
    evidenceIds: string[];
    tags: string[];
  }>;
  evidence: Array<{
    id: string;
    claimIds: string[];
    title: LocalizedText;
    evidenceType: "public-source" | "owner-attestation" | "repository" | "credential" | "artifact";
    strength: "self-attested" | "corroborated" | "primary";
    lifecycle: "available" | "restricted" | "archived" | "unavailable";
    source: {
      label: LocalizedText;
      visibility: "public" | "public-summary" | "private-reference";
      url?: string;
    };
    observedAt: string;
  }>;
  relationships: Array<{
    id: string;
    type: "performed-for" | "provided-by" | "supports" | "related-to";
    sourceId: string;
    targetId: string;
  }>;
}

