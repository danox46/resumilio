import profileDocument from "../profiles/daniel.json";
import type { Locale, ResumilioProfile } from "./profile.js";
import { buildEvidenceExport, buildGraphExport, buildLlmsText, buildResumeExport, buildSearchIndex, jsonResponse, textResponse } from "./public-contracts.js";

export const publicProfile = profileDocument as ResumilioProfile;

export function resumeEndpoint(locale: Locale): Response {
  return jsonResponse(buildResumeExport(publicProfile, locale), locale);
}

export function evidenceEndpoint(locale: Locale): Response {
  return jsonResponse(buildEvidenceExport(publicProfile, locale), locale);
}

export function graphEndpoint(locale: Locale): Response {
  return jsonResponse(buildGraphExport(publicProfile, locale), locale);
}

export function searchEndpoint(locale: Locale): Response {
  return jsonResponse(buildSearchIndex(publicProfile, locale), locale);
}

export function llmsEndpoint(locale: Locale, full = false): Response {
  return textResponse(buildLlmsText(publicProfile, locale, full), locale);
}
