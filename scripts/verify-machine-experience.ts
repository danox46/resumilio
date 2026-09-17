import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import profileDocument from "../profiles/daniel.json" with { type: "json" };
import type { Locale, ResumilioProfile } from "../src/profile.js";
import { classicClaimPath, classicPath, siteOrigin } from "../src/site.js";

const profile = profileDocument as ResumilioProfile;
const root = resolve("site-dist");
const read = (path: string) => readFile(resolve(root, path), "utf8");
const json = async (path: string) => JSON.parse(await read(path));
const ajv = new Ajv2020({ allErrors: true, strict: true });
const schema = async (name: string) => JSON.parse(await read(`schemas/${name}.json`));

const resources = [
  ["resume.json", "resume.v1.schema"],
  ["evidence.json", "evidence.v1.schema"],
  ["graph.json", "graph.v1.schema"],
  ["search-index.json", "search-index.v1.schema"],
] as const;
const validators = new Map<string, ReturnType<typeof ajv.compile>>();
for (const [, schemaName] of resources) validators.set(schemaName, ajv.compile(await schema(schemaName)));
for (const prefix of ["", "es/"]) {
  for (const [file, schemaName] of resources) {
    const validate = validators.get(schemaName)!;
    const value = await json(`${prefix}${file}`);
    assert.equal(validate(value), true, `${prefix}${file}: ${ajv.errorsText(validate.errors)}`);
    assert.equal(value.locale, prefix ? "es" : "en");
  }
  for (const file of ["llms.txt", "llms-full.txt"]) {
    const content = await read(`${prefix}${file}`);
    for (const claim of profile.claims) assert.match(content, new RegExp(claim.id));
  }
}

const discoverySchema = await schema("discovery.v1.schema");
const validateDiscovery = ajv.compile(discoverySchema);
for (const path of [".well-known/resumilio", ".well-known/resumilio.json"]) {
  assert.equal(validateDiscovery(await json(path)), true, `${path}: ${ajv.errorsText(validateDiscovery.errors)}`);
}

const expectedOrigin = siteOrigin;
for (const locale of ["en", "es"] as Locale[]) {
  const prefix = locale === "en" ? "" : "es/";
  const home = await read(`${prefix}index.html`);
  assert.match(home, new RegExp(`<link rel="canonical" href="${expectedOrigin}${locale === "en" ? "/" : "/es/"}"`));
  assert.match(home, /hreflang="en"/);
  assert.match(home, /hreflang="es"/);
  assert.match(home, /property="og:title"/);
  assert.match(home, /name="twitter:card"/);
  assert.match(home, /"@type":"ProfilePage"/);
  assert.match(home, /"@type":"Person"/);
  const classicFile = locale === "en" ? "classic/index.html" : "es/clasico/index.html";
  const classicHtml = await read(classicFile);
  assert.match(classicHtml, /hreflang="en"/);
  assert.match(classicHtml, /hreflang="es"/);
  assert.match(classicHtml, /"@type":"ProfilePage"/);
  assert.match(classicHtml, /"@type":"Person"/);
  assert.match(classicHtml, /CreativeWork/);
  assert.match(classicHtml, /SoftwareSourceCode/);
  for (const claim of profile.claims) {
    assert.match(classicHtml, new RegExp(claim.title[locale].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(classicHtml, new RegExp(`id="${claim.id}"`));
    for (const evidenceId of claim.evidenceIds) assert.match(classicHtml, new RegExp(`id="${evidenceId}"`));
    const legacyPath = locale === "en" ? `evidence/${claim.id}/index.html` : `es/evidencia/${claim.id}/index.html`;
    assert.match(await read(legacyPath), new RegExp(classicClaimPath(claim.id, locale).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
}

const sitemap = await read("sitemap.xml");
assert.match(sitemap, /xmlns:xhtml="http:\/\/www.w3.org\/1999\/xhtml"/);
assert.match(sitemap, new RegExp(classicPath("en")));
assert.match(sitemap, new RegExp(classicPath("es")));
assert.doesNotMatch(sitemap, /\/evidence\/claim-|\/es\/evidencia\/claim-/);
assert.ok((await read("robots.txt")).includes(`Sitemap: ${siteOrigin}/sitemap.xml`));
assert.match(await read("_headers"), /s-maxage=3600/);

console.log(JSON.stringify({
  valid: true,
  jsonEndpoints: 10,
  textEndpoints: 6,
  schemaEndpoints: 6,
  classicResumePages: 2,
  legacyRedirects: profile.claims.length * 2,
  locales: ["en", "es"],
  citationResolutionHops: 1,
  structuredTypes: ["Person", "ProfilePage", "CreativeWork", "SoftwareSourceCode"],
}, null, 2));
