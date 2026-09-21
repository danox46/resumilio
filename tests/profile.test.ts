import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { ResumilioProfile } from "../core/profile.js";
import { validateProfileDocument } from "../core/validation.js";

const demo = JSON.parse(await readFile("profiles/demo.json", "utf8")) as ResumilioProfile;

test("fictional bilingual demo satisfies the public contract", () => {
  const result = validateProfileDocument(demo);
  assert.deepEqual(result.errors, []);
});

test("one-language profiles are supported", () => {
  const profile = structuredClone(demo);
  profile.profile.locales = ["en"];
  const trim = (value: Record<string, string>) => { for (const key of Object.keys(value)) if (key !== "en") delete value[key]; };
  trim(profile.profile.name); trim(profile.profile.headline); trim(profile.profile.summary);
  for (const contact of profile.profile.contacts) trim(contact.label);
  for (const organization of profile.organizations) trim(organization.name);
  for (const item of profile.careerItems) { trim(item.title); trim(item.summary); }
  for (const resource of profile.resources) trim(resource.label);
  assert.equal(validateProfileDocument(profile).valid, true);
});

test("NDA-protected resources reject URLs", () => {
  const profile = structuredClone(demo);
  const resource = profile.resources.find((item) => item.kind === "nda-protected")!;
  resource.url = "https://example.com/private";
  assert.equal(validateProfileDocument(profile).valid, false);
});
