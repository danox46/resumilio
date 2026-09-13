import type { Locale } from "./profile.js";

export const siteOrigin = (process.env.PUBLIC_SITE_ORIGIN ?? "https://resumilio.danielx9.workers.dev").replace(/\/+$/, "");

export function localeRoot(locale: Locale): string {
  return locale === "en" ? "/" : "/es/";
}

export function claimPath(claimId: string, locale: Locale): string {
  return locale === "en" ? `/evidence/${claimId}/` : `/es/evidencia/${claimId}/`;
}

export function localizedPath(path: string, locale: Locale): string {
  return locale === "en" ? path : `/es${path}`;
}

export function absoluteUrl(path: string): string {
  return new URL(path, `${siteOrigin}/`).toString();
}
