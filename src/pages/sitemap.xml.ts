import profileDocument from "../../profiles/daniel.json";
import type { ResumilioProfile } from "../profile";
import { absoluteUrl, claimPath, localeRoot } from "../site";
import { textResponse } from "../public-contracts";

const profile = profileDocument as ResumilioProfile;
const escapeXml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
const brandPath = (locale: "en" | "es") => locale === "en" ? "/about/" : "/es/acerca/";
const entries = (["en", "es"] as const).flatMap((locale) => [localeRoot(locale), brandPath(locale), ...profile.claims.map((claim) => claimPath(claim.id, locale))].map((path) => ({ path, locale })));

export const prerender = true;
export const GET = () => {
  const urls = entries.map(({ path, locale }) => {
    const alternate = locale === "en" ? "es" : "en";
    const claim = profile.claims.find((item) => path.includes(item.id));
    const isBrand = path === brandPath(locale);
    const alternatePath = claim ? claimPath(claim.id, alternate) : isBrand ? brandPath(alternate) : localeRoot(alternate);
    const defaultPath = claim ? claimPath(claim.id, "en") : isBrand ? brandPath("en") : localeRoot("en");
    return `<url><loc>${escapeXml(absoluteUrl(path))}</loc><xhtml:link rel="alternate" hreflang="${locale}" href="${escapeXml(absoluteUrl(path))}"/><xhtml:link rel="alternate" hreflang="${alternate}" href="${escapeXml(absoluteUrl(alternatePath))}"/><xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(absoluteUrl(defaultPath))}"/></url>`;
  }).join("");
  return textResponse(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls}</urlset>`, "en", "application/xml; charset=utf-8");
};
