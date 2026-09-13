import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import type { ResumilioProfile } from "../src/profile.ts";
import { validateProfileDocument } from "../src/validation.ts";

const seedPath = fileURLToPath(new URL("../profiles/daniel.json", import.meta.url));
const seed = JSON.parse(await readFile(seedPath, "utf8")) as ResumilioProfile;
const clone = () => structuredClone(seed);

test("Daniel seed satisfies the bilingual evidence graph contract", () => {
  const result = validateProfileDocument(seed);
  assert.equal(result.valid, true, result.errors.join("\n"));
  assert.deepEqual(seed.profile.locales, ["en", "es"]);
});

test("Daniel seed preserves the four approved truth distinctions", () => {
  const claims = new Map(seed.claims.map((claim) => [claim.id, claim]));
  assert.equal(claims.get("claim-professional-ai-text-completion")?.lifecycle, "working-prelaunch");
  assert.equal(claims.get("claim-hubspot-sms-app")?.lifecycle, "shipped");
  assert.ok(claims.get("claim-hubspot-sms-app")?.tags.includes("non-ai"));
  assert.equal(claims.get("claim-masglo-commercial-proposal")?.lifecycle, "proposal");
  assert.equal(claims.get("claim-google-cloud-big-data-course")?.lifecycle, "completed");
  assert.equal(claims.get("claim-google-cloud-big-data-course")?.title.en, "Google Cloud Big Data and Machine Learning Fundamentals");
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
  candidate.claims[0].summary.en = ["Running in pro", "duction"].join("");
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
