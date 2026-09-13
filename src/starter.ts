import type { ResumilioProfile } from "./profile.js";

export function createStarterProfile(): ResumilioProfile {
  return {
    schemaVersion: "1.0.0",
    profile: {
      id: "your-name",
      name: { en: "Your Name", es: "Tu Nombre" },
      headline: { en: "What you do", es: "Lo que haces" },
      summary: {
        en: "A short, factual introduction grounded in real work.",
        es: "Una introducción breve y factual basada en trabajo real.",
      },
      defaultLocale: "en",
      locales: ["en", "es"],
      contacts: [
        {
          id: "contact-github",
          kind: "github",
          label: { en: "GitHub", es: "GitHub" },
          url: "https://github.com/your-handle",
        },
      ],
    },
    organizations: [],
    claims: [
      {
        id: "claim-first-project",
        type: "project",
        lifecycle: "completed",
        title: { en: "First project", es: "Primer proyecto" },
        summary: {
          en: "Replace this starter claim with a concise, supportable result.",
          es: "Reemplaza esta afirmación inicial con un resultado conciso y verificable.",
        },
        evidenceIds: ["evidence-first-project"],
        tags: ["starter"],
      },
    ],
    evidence: [
      {
        id: "evidence-first-project",
        claimIds: ["claim-first-project"],
        title: { en: "Owner attestation", es: "Declaración del titular" },
        evidenceType: "owner-attestation",
        strength: "self-attested",
        lifecycle: "restricted",
        source: {
          label: {
            en: "Public summary; replace with stronger evidence when available",
            es: "Resumen público; reemplázalo con evidencia más sólida cuando esté disponible",
          },
          visibility: "public-summary",
        },
        observedAt: "2026-09-12",
      },
    ],
    relationships: [],
  };
}
