import type { Locale, ResumilioProfile } from "./profile.js";
import type { DiscoveryState } from "./discovery.js";

type Claim = ResumilioProfile["claims"][number];
type Evidence = ResumilioProfile["evidence"][number];

const valueLabels: Record<Locale, Record<string, string>> = {
  en: {
    experience: "Professional experience",
    project: "Portfolio project",
    education: "Education",
    certification: "Certification",
    publication: "Publication",
    skill: "Skill",
    "working-prelaunch": "Built · pre-launch",
    shipped: "Launched",
    proposal: "Portfolio concept",
    completed: "Completed",
    production: "In production",
    idea: "Concept",
    retired: "Archived",
    "self-attested": "Professional summary",
    corroborated: "Documented work history",
    primary: "Public project or credential",
    public: "Publicly available",
    "public-summary": "Professional summary",
    restricted: "Private work materials",
  },
  es: {
    experience: "Experiencia profesional",
    project: "Proyecto de portafolio",
    education: "Formación",
    certification: "Certificación",
    publication: "Publicación",
    skill: "Habilidad",
    "working-prelaunch": "Construido · prelanzamiento",
    shipped: "Lanzado",
    proposal: "Concepto de portafolio",
    completed: "Completado",
    production: "En producción",
    idea: "Concepto",
    retired: "Archivado",
    "self-attested": "Resumen profesional",
    corroborated: "Trayectoria documentada",
    primary: "Proyecto o credencial pública",
    public: "Disponible públicamente",
    "public-summary": "Resumen profesional",
    restricted: "Material de trabajo privado",
  },
};

const claimSummaries: Record<string, Record<Locale, string>> = {
  "claim-professional-ai-text-completion": {
    en: "Led the development of a working HubSpot custom app that brings OpenAI-assisted text completion into a practical CRM workflow. The product is built and currently pre-launch.",
    es: "Lideró el desarrollo de una aplicación funcional para HubSpot que integra texto asistido por OpenAI en un flujo práctico de CRM. El producto está construido y actualmente en prelanzamiento.",
  },
  "claim-hubspot-sms-app": {
    en: "Built and launched a HubSpot SMS custom app that connects messaging workflows directly to the CRM. This integration does not use AI.",
    es: "Construyó y lanzó una aplicación de SMS para HubSpot que conecta los flujos de mensajería directamente con el CRM. Esta integración no usa IA.",
  },
  "claim-masglo-commercial-proposal": {
    en: "Designed a commercial facial-recognition concept and public portfolio implementation for Masglo. Created as a proposal, not a paid client engagement.",
    es: "Diseñó un concepto comercial de reconocimiento facial y una implementación pública de portafolio para Masglo. Se creó como propuesta, no como trabajo pagado por el cliente.",
  },
  "claim-google-cloud-big-data-course": {
    en: "Completed Google Cloud Big Data and Machine Learning Fundamentals through Coursera.",
    es: "Completó Fundamentos de Big Data y aprendizaje automático de Google Cloud a través de Coursera.",
  },
};

const evidenceTitles: Record<string, Record<Locale, string>> = {
  "evidence-professional-ai-owner-record": {
    en: "Professional product work",
    es: "Trabajo profesional de producto",
  },
  "evidence-hubspot-sms-owner-record": {
    en: "Launched CRM integration",
    es: "Integración CRM lanzada",
  },
  "evidence-masglo-public-repository": {
    en: "Public project on GitHub",
    es: "Proyecto público en GitHub",
  },
  "evidence-google-cloud-course-credential": {
    en: "Google Cloud course completion",
    es: "Curso completado de Google Cloud",
  },
};

const sourceSummaries: Record<string, Record<Locale, string>> = {
  "evidence-professional-ai-owner-record": {
    en: "Professional work summary · client materials remain private",
    es: "Resumen de experiencia profesional · el material del cliente permanece privado",
  },
  "evidence-hubspot-sms-owner-record": {
    en: "Launched work summary · client materials remain private",
    es: "Resumen de trabajo lanzado · el material del cliente permanece privado",
  },
  "evidence-google-cloud-course-credential": {
    en: "Course completion verified · credential kept private",
    es: "Curso completado y verificado · la credencial permanece privada",
  },
};

export function marketLabel(value: string, locale: Locale): string {
  return valueLabels[locale][value] ?? `${value.charAt(0).toUpperCase()}${value.slice(1).replaceAll("-", " ")}`;
}

export function marketClaimSummary(claim: Claim, locale: Locale): string {
  return claimSummaries[claim.id]?.[locale] ?? claim.summary[locale];
}

export function marketEvidenceTitle(evidence: Evidence, locale: Locale): string {
  return evidenceTitles[evidence.id]?.[locale] ?? evidence.title[locale];
}

export function marketSourceSummary(evidence: Evidence, locale: Locale): string {
  if (evidence.source.visibility === "public") return evidence.source.label[locale];
  return sourceSummaries[evidence.id]?.[locale] ?? marketLabel(evidence.source.visibility, locale);
}

function displayTopic(topic: string): string {
  const names: Record<string, string> = { hubspot: "HubSpot", openai: "OpenAI", sms: "SMS", "non ai": "non-AI" };
  return names[topic] ?? topic.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function marketRecommendationReason(state: DiscoveryState, locale: Locale): string {
  const top = Object.entries(state.topics).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([topic]) => displayTopic(topic));
  if (!top.length) return locale === "es" ? "Una muestra clara de experiencia reciente y relevante" : "A clear example of recent, relevant work";
  const joined = top.length === 1 ? top[0] : locale === "es" ? `${top[0]} y ${top[1]}` : `${top[0]} and ${top[1]}`;
  return locale === "es" ? `Relacionado con tu interés en ${joined}` : `Related to your interest in ${joined}`;
}
