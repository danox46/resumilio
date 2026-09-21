export type LocaleCode = string;
export type LocalizedText = Record<LocaleCode, string>;

export type CareerItemKind = "role" | "project" | "education" | "certification" | "publication" | "skill";
export type CareerItemState = "current" | "available" | "completed" | "in-development" | "archived";
export type ResourceKind = "live-demo" | "external-preview" | "public-repository" | "online-certificate" | "work-sample" | "nda-protected";
export type ResourceAvailability = "public" | "restricted" | "unavailable";

export interface ResumilioProfile {
  schemaVersion: "1.0.0";
  profile: {
    id: string;
    name: LocalizedText;
    headline: LocalizedText;
    summary: LocalizedText;
    defaultLocale: LocaleCode;
    locales: LocaleCode[];
    contacts: Array<{
      id: string;
      kind: "github" | "linkedin" | "portfolio" | "email" | "meeting" | "other";
      label: LocalizedText;
      url: string;
    }>;
  };
  organizations: Array<{ id: string; name: LocalizedText; url?: string }>;
  careerItems: Array<{
    id: string;
    kind: CareerItemKind;
    state: CareerItemState;
    title: LocalizedText;
    summary: LocalizedText;
    organizationId?: string;
    startDate?: string;
    endDate?: string;
    resourceIds: string[];
    tags: string[];
  }>;
  resources: Array<{
    id: string;
    careerItemIds: string[];
    label: LocalizedText;
    kind: ResourceKind;
    availability: ResourceAvailability;
    url?: string;
  }>;
  connections: Array<{
    id: string;
    sourceId: string;
    targetId: string;
    kind: "related-to" | "built-on" | "performed-for" | "learned-through";
  }>;
}

export interface ResumilioConfig {
  schemaVersion: 1;
  profile: string;
  presentation: {
    companion: { enabled: boolean; variant: "orbit-pet" | "custom"; customMedia?: Record<string, string> };
    palette: { background: string; text: string; accent: string; muted: string };
    activeNodes: { mobile: number; desktop: number };
  };
}

export function localized(value: LocalizedText, locale: LocaleCode, fallback: LocaleCode): string {
  return value[locale] ?? value[fallback] ?? Object.values(value)[0] ?? "";
}
