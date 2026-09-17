import type { Locale } from "./profile.js";

const viteEnvironment = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
const nodeEnvironment = (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process?.env;

export const siteOrigin = (viteEnvironment?.PUBLIC_SITE_ORIGIN ?? nodeEnvironment?.PUBLIC_SITE_ORIGIN ?? "https://resumilio.danielx9.workers.dev").replace(/\/+$/, "");
export const basePath = `/${String(viteEnvironment?.PUBLIC_BASE_PATH ?? nodeEnvironment?.PUBLIC_BASE_PATH ?? "").replace(/^\/+|\/+$/g, "")}`.replace(/^\/$/, "");
export const meetingUrl = "https://calendar.app.google/cYk39Z5KxyPobwMg7";

export function publicPath(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (!basePath || normalizedPath === basePath || normalizedPath.startsWith(`${basePath}/`)) return normalizedPath;
  return `${basePath}${normalizedPath}`;
}

export function localeRoot(locale: Locale): string {
  return publicPath(locale === "en" ? "/" : "/es/");
}

export function claimPath(claimId: string, locale: Locale): string {
  return publicPath(locale === "en" ? `/evidence/${claimId}/` : `/es/evidencia/${claimId}/`);
}

export function classicPath(locale: Locale): string {
  return publicPath(locale === "en" ? "/classic/" : "/es/clasico/");
}

export function classicClaimPath(claimId: string, locale: Locale): string {
  return `${classicPath(locale)}#${claimId}`;
}

export function classicEvidencePath(evidenceId: string, locale: Locale): string {
  return `${classicPath(locale)}#${evidenceId}`;
}

export function localizedPath(path: string, locale: Locale): string {
  return locale === "en" ? path : `/es${path}`;
}

export function absoluteUrl(path: string): string {
  return new URL(publicPath(path), `${siteOrigin}/`).toString();
}
