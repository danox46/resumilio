import { absoluteUrl, classicPath, localeRoot } from "../site";
import { textResponse } from "../public-contracts";

const escapeXml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
const entries = (["en", "es"] as const).flatMap((locale) => [localeRoot(locale), classicPath(locale)].map((path) => ({ path, locale })));

export const prerender = true;
export const GET = () => {
  const urls = entries.map(({ path, locale }) => {
    const alternate = locale === "en" ? "es" : "en";
    const isClassic = path === classicPath(locale);
    const alternatePath = isClassic ? classicPath(alternate) : localeRoot(alternate);
    const defaultPath = isClassic ? classicPath("en") : localeRoot("en");
    return `<url><loc>${escapeXml(absoluteUrl(path))}</loc><xhtml:link rel="alternate" hreflang="${locale}" href="${escapeXml(absoluteUrl(path))}"/><xhtml:link rel="alternate" hreflang="${alternate}" href="${escapeXml(absoluteUrl(alternatePath))}"/><xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(absoluteUrl(defaultPath))}"/></url>`;
  }).join("");
  return textResponse(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls}</urlset>`, "en", "application/xml; charset=utf-8");
};
