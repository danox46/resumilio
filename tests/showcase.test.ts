import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import type { ResumilioProfile } from "../src/profile.js";
import { emptyDiscoveryState, rankConstellationRecommendations } from "../src/discovery.js";
import { claimShowcase, claimShowcaseKind, claimShowcases, showcaseRecommendationWeight } from "../src/showcase.js";

const repository = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const profile = JSON.parse(await readFile(resolve(repository, "profiles/daniel.json"), "utf8")) as ResumilioProfile;
const claim = (id: string) => profile.claims.find((item) => item.id === id)!;

test("showcase states turn public availability into useful job-market labels", () => {
  assert.deepEqual(claimShowcase(profile, claim("claim-alphahub-hubspot-specialist"), "en"), {
    kind: "professional-role",
    label: "Professional role",
    href: "https://www.linkedin.com/in/danieltalking/",
  });
  assert.equal(claimShowcase(profile, claim("claim-leaf-town"), "en").kind, "live-demo");
  assert.equal(claimShowcase(profile, claim("claim-masglo-commercial-proposal"), "en").kind, "public-source");
  assert.equal(claimShowcase(profile, claim("claim-how-google-does-machine-learning"), "en").kind, "certificate");
  assert.equal(claimShowcase(profile, claim("claim-computer-science-studies"), "en").kind, "external-preview");
  assert.equal(claimShowcase(profile, claim("claim-hubspot-sms-app"), "en").kind, "private-context");
  assert.deepEqual(claimShowcases(profile, claim("claim-resumilio-living-resume"), "en").map((item) => item.kind), ["live-demo", "public-source"]);

  for (const locale of ["en", "es"] as const) {
    for (const item of profile.claims.map((entry) => claimShowcase(profile, entry, locale))) {
      assert.doesNotMatch(item.label, /evidence|proof|evidencia|prueba/i);
      if (item.href) assert.match(item.href, /^https:\/\//);
    }
  }
});

test("NDA state is explicit and availability weighting stays secondary", () => {
  const protectedClaim = structuredClone(claim("claim-hubspot-sms-app"));
  protectedClaim.tags.push("nda-protected");
  assert.equal(claimShowcaseKind(profile, protectedClaim), "nda-protected");
  assert.ok(showcaseRecommendationWeight(profile, claim("claim-alphahub-hubspot-specialist")) < 1);
  assert.ok(showcaseRecommendationWeight(profile, claim("claim-leaf-town")) < 1);
  assert.ok(showcaseRecommendationWeight(profile, protectedClaim) < showcaseRecommendationWeight(profile, claim("claim-leaf-town")));
});

test("the mobile recommendation window favors a useful availability mix without overriding graph rules", () => {
  const center = claim("claim-alphahub-hubspot-specialist");
  const mobileWindow = rankConstellationRecommendations(profile, emptyDiscoveryState(), center.id, 5).slice(0, 3);
  const kinds = mobileWindow.map((item) => claimShowcaseKind(profile, item.claim));
  assert.equal(new Set(kinds).size, 3);
});
