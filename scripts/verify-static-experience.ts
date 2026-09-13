import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Locale, ResumilioProfile } from "../src/profile.js";

const profile = JSON.parse(await readFile(resolve("profiles/daniel.json"), "utf8")) as ResumilioProfile;

for (const [locale, file] of [["en", "site-dist/index.html"], ["es", "site-dist/es/index.html"]] as Array<[Locale, string]>) {
  const html = await readFile(resolve(file), "utf8");
  assert.match(html, new RegExp(`<html lang="${locale}"`));
  assert.ok(html.includes(profile.profile.name[locale]));
  assert.ok(html.includes(profile.profile.headline[locale]));
  for (const claim of profile.claims) {
    assert.ok(html.includes(claim.title[locale]), `${file} is missing ${claim.id}`);
    assert.ok(html.includes(`id="${claim.id}"`), `${file} is missing deep link ${claim.id}`);
  }
  for (const evidence of profile.evidence) assert.ok(html.includes(evidence.title[locale]), `${file} is missing ${evidence.id}`);
}

console.log(JSON.stringify({
  valid: true,
  routes: ["/", "/es/"],
  locales: profile.profile.locales,
  claimsAvailableWithoutJavaScript: profile.claims.length,
  evidenceAvailableWithoutJavaScript: profile.evidence.length,
  deepLinksVerified: profile.claims.length,
}, null, 2));
