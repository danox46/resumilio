import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import profileDocument from "../profiles/daniel.json" with { type: "json" };
import { evidenceEndpoint, graphEndpoint, publicProfile, resumeEndpoint, searchEndpoint } from "../src/endpoint-data.js";
import { buildDiscoveryManifest, buildEvidenceExport, buildGraphExport, buildResumeExport, buildSearchIndex } from "../src/public-contracts.js";
import type { Locale, ResumilioProfile } from "../src/profile.js";
import { buildClaimJsonLd, buildProfileJsonLd } from "../src/structured-data.js";

const profile = profileDocument as ResumilioProfile;
const ajv = new Ajv2020({ allErrors: true, strict: true });
const schemas = {
  resume: JSON.parse(readFileSync(new URL("../schemas/resume.v1.schema.json", import.meta.url), "utf8")),
  evidence: JSON.parse(readFileSync(new URL("../schemas/evidence.v1.schema.json", import.meta.url), "utf8")),
  graph: JSON.parse(readFileSync(new URL("../schemas/graph.v1.schema.json", import.meta.url), "utf8")),
  search: JSON.parse(readFileSync(new URL("../schemas/search-index.v1.schema.json", import.meta.url), "utf8")),
  discovery: JSON.parse(readFileSync(new URL("../schemas/discovery.v1.schema.json", import.meta.url), "utf8")),
};
const roundTrip = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

test("localized machine exports validate against their public schemas", () => {
  for (const locale of ["en", "es"] as Locale[]) {
    const exports = {
      resume: roundTrip(buildResumeExport(profile, locale)),
      evidence: roundTrip(buildEvidenceExport(profile, locale)),
      graph: roundTrip(buildGraphExport(profile, locale)),
      search: roundTrip(buildSearchIndex(profile, locale)),
    };
    for (const [kind, value] of Object.entries(exports)) {
      const validate = ajv.compile(schemas[kind as keyof typeof exports]);
      assert.equal(validate(value), true, `${locale} ${kind}: ${ajv.errorsText(validate.errors)}`);
    }
  }
  const validateDiscovery = ajv.compile(schemas.discovery);
  assert.equal(validateDiscovery(buildDiscoveryManifest(profile)), true, ajv.errorsText(validateDiscovery.errors));
});

test("English and Spanish exports preserve stable IDs and one-hop evidence citations", () => {
  const english = buildResumeExport(profile, "en");
  const spanish = buildResumeExport(profile, "es");
  assert.deepEqual(english.claims.map((item) => item.id), spanish.claims.map((item) => item.id));
  assert.deepEqual(english.claims.flatMap((item) => item.evidence.map((evidence) => evidence.id)), spanish.claims.flatMap((item) => item.evidence.map((evidence) => evidence.id)));
  for (const claim of english.claims) {
    assert.match(claim.url, new RegExp(`/classic/#${claim.id}$`));
    for (const evidence of claim.evidence) assert.match(evidence.url, new RegExp(`/classic/#${evidence.id}$`));
  }
  for (const claim of spanish.claims) assert.match(claim.url, new RegExp(`/es/clasico/#${claim.id}$`));
});

test("machine responses advertise cache, language, and safe content headers", async () => {
  for (const [locale, responses] of [["en", [resumeEndpoint("en"), evidenceEndpoint("en"), graphEndpoint("en"), searchEndpoint("en")]], ["es", [resumeEndpoint("es"), evidenceEndpoint("es"), graphEndpoint("es"), searchEndpoint("es")]]] as const) {
    for (const response of responses) {
      assert.match(response.headers.get("cache-control") ?? "", /s-maxage=3600/);
      assert.equal(response.headers.get("content-language"), locale);
      assert.equal(response.headers.get("x-content-type-options"), "nosniff");
      assert.match(response.headers.get("content-type") ?? "", /application\/json/);
      assert.equal(response.status, 200);
      await response.body?.cancel();
    }
  }
});

test("structured data contains only profile entities derived from the validated graph", () => {
  const knownIds = new Set([profile.profile.id, ...profile.organizations.map((item) => item.id), ...profile.claims.map((item) => item.id), ...profile.evidence.map((item) => item.id)]);
  for (const locale of ["en", "es"] as Locale[]) {
    const root = buildProfileJsonLd(profile, locale) as { "@graph": Array<Record<string, unknown>> };
    assert.ok(root["@graph"].some((item) => item["@type"] === "ProfilePage"));
    assert.ok(root["@graph"].some((item) => item["@type"] === "Person"));
    for (const claim of profile.claims) {
      const document = buildClaimJsonLd(profile, claim, locale) as { "@graph": Array<Record<string, unknown>> };
      const serialized = JSON.stringify(document);
      assert.match(serialized, new RegExp(claim.id));
      for (const evidenceId of claim.evidenceIds) assert.match(serialized, new RegExp(evidenceId));
      assert.ok(document["@graph"].some((item) => item["@type"] === "ProfilePage"));
      assert.ok(document["@graph"].some((item) => item["@type"] === "Person"));
      assert.ok(document["@graph"].some((item) => Array.isArray(item["@type"]) ? item["@type"].includes("CreativeWork") : item["@type"] === "CreativeWork"));
      if (claim.id === "claim-masglo-commercial-proposal") assert.match(serialized, /SoftwareSourceCode/);
      for (const id of serialized.match(/(?:claim|evidence|organization)-[a-z0-9-]+/g) ?? []) assert.ok(knownIds.has(id), `Unknown structured-data entity ${id}`);
    }
  }
  assert.equal(publicProfile.profile.id, profile.profile.id);
});
