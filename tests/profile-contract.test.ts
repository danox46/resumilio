import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import type { ResumilioProfile } from "../src/profile.js";
import { validateProfileDocument } from "../src/validation.js";

const seedPath = fileURLToPath(new URL("../profiles/daniel.json", import.meta.url));
const seed = JSON.parse(await readFile(seedPath, "utf8")) as ResumilioProfile;
const clone = () => structuredClone(seed);

test("Daniel seed satisfies the bilingual evidence graph contract", () => {
  const result = validateProfileDocument(seed);
  assert.equal(result.valid, true, result.errors.join("\n"));
  assert.deepEqual(seed.profile.locales, ["en", "es"]);
});

test("Daniel profile preserves approved truth distinctions and career breadth", () => {
  const claims = new Map(seed.claims.map((claim) => [claim.id, claim]));
  assert.equal(claims.get("claim-professional-ai-text-completion")?.lifecycle, "working-prelaunch");
  assert.equal(claims.get("claim-hubspot-sms-app")?.lifecycle, "shipped");
  assert.ok(claims.get("claim-hubspot-sms-app")?.tags.includes("non-ai"));
  assert.equal(claims.get("claim-masglo-commercial-proposal")?.lifecycle, "proposal");
  assert.equal(claims.get("claim-google-cloud-big-data-course")?.lifecycle, "completed");
  assert.equal(claims.get("claim-google-cloud-big-data-course")?.title.en, "Google Cloud Big Data and Machine Learning Fundamentals");
  assert.equal(claims.get("claim-alphahub-hubspot-specialist")?.lifecycle, "production");
  assert.equal(claims.get("claim-on-the-fuze-backend-lead")?.type, "experience");
  assert.equal(claims.get("claim-hubspot-academy-credentials")?.type, "certification");
  assert.equal(claims.get("claim-hubspot-marketing-software")?.type, "certification");
  assert.equal(claims.get("claim-hubspot-reporting")?.type, "certification");
  assert.equal(claims.get("claim-hubspot-cms-marketers")?.type, "certification");
  assert.equal(claims.get("claim-hubspot-revenue-operations")?.type, "certification");
  assert.equal(claims.get("claim-hubspot-cms-developers")?.type, "certification");
  assert.equal(claims.get("claim-platzi-node-backend-courses")?.type, "certification");
  assert.equal(claims.get("claim-yunoia-certified-journalist")?.type, "certification");
  assert.equal(claims.get("claim-freelance-transcriptionist")?.type, "experience");
  assert.equal(claims.get("claim-pb-collections-regional-distributor")?.type, "experience");
  assert.equal(claims.get("claim-freelance-content-creator")?.type, "experience");
  assert.equal(claims.get("claim-the-loot-gaming-contributor")?.type, "experience");
  assert.equal(claims.get("claim-hivebound-founder")?.type, "experience");
  assert.equal(claims.get("claim-dnx-gaming-founder")?.type, "experience");
  assert.equal(claims.get("claim-leaf-town")?.lifecycle, "shipped");
  assert.equal(claims.get("claim-children-of-preservation")?.lifecycle, "shipped");
  assert.equal(claims.get("claim-resumilio-living-resume")?.lifecycle, "shipped");
  assert.ok(seed.profile.contacts.some((contact) => contact.id === "contact-itch" && contact.url === "https://dnxgaming.itch.io/"));
  const related = seed.relationships.filter((relationship) => relationship.type === "related-to");
  assert.ok(related.some((relationship) => relationship.sourceId === "claim-operations-company-integration-specialist" && relationship.targetId === "claim-masglo-commercial-proposal"));
  assert.equal(related.filter((relationship) => relationship.sourceId === "claim-masglo-commercial-proposal").length, 4);
  assert.ok(seed.claims.length >= 32);
  assert.ok(seed.organizations.length >= 16);
});

test("private career artifacts remain locator-free", () => {
  const privateSources = seed.evidence.filter((item) => item.source.visibility !== "public");
  assert.ok(privateSources.length > 0);
  assert.ok(privateSources.every((item) => item.source.url === undefined));
});

test("missing Spanish copy fails validation", () => {
  const candidate = clone() as unknown as { profile: { headline: { en: string; es?: string } } };
  delete candidate.profile.headline.es;
  const result = validateProfileDocument(candidate);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("required property 'es'")));
});

test("orphaned evidence fails validation", () => {
  const candidate = clone();
  candidate.claims[0].evidenceIds = ["evidence-does-not-exist"];
  const result = validateProfileDocument(candidate);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("missing evidence")));
});

test("working-prelaunch copy cannot imply a later release stage", () => {
  const candidate = clone();
  const claim = candidate.claims.find((item) => item.id === "claim-professional-ai-text-completion")!;
  claim.summary.en = ["Running in pro", "duction"].join("");
  const result = validateProfileDocument(candidate);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("later-stage release label")));
});

test("non-public evidence cannot expose a locator", () => {
  const candidate = clone();
  candidate.evidence[0].source.url = ["https://example", ".com/private"].join("");
  const result = validateProfileDocument(candidate);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("must not expose")));
});

test("unapproved contact kinds fail schema validation", () => {
  const candidate = clone() as unknown as { profile: { contacts: Array<Record<string, unknown>> } };
  candidate.profile.contacts.push({
    id: "contact-private",
    kind: ["ph", "one"].join(""),
    label: { en: "Private", es: "Privado" },
    url: ["te", "l:", "+1", "000", "000", "0000"].join(""),
  });
  const result = validateProfileDocument(candidate);
  assert.equal(result.valid, false);
});
