import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { migrateProfileDocument } from "../core/migration.js";
import { analyzeGraphHealth } from "../core/graph.js";
import { validateProfileDocument } from "../core/validation.js";

const reference = JSON.parse(await readFile("tests/fixtures/reference-v1-fictional.json", "utf8")) as Record<string, unknown>;
const packageDemo = JSON.parse(await readFile("profiles/demo.json", "utf8")) as Record<string, unknown>;

test("reference v1 migrates IDs, locales, lifecycle, connections, and public provenance without promotion", () => {
  const { profile, receipt } = migrateProfileDocument(reference);
  assert.equal(profile.schemaVersion, "2.0.0");
  assert.equal(profile.careerItems.length, 3);
  assert.deepEqual(profile.profile.locales, ["en", "es"]);
  assert.equal(profile.careerItems.find((item) => item.id === "private-workflow")?.state, "proposal");
  assert.equal(profile.careerItems.find((item) => item.id === "integration-lead")?.kind, "role");
  assert.equal(profile.connections.find((item) => item.id === "relationship-lead-workflow")?.kind, "supports");
  assert.equal(profile.connections.find((item) => item.id === "relationship-lead-studio")?.targetId, "fictional-studio");
  assert.equal(profile.connections.find((item) => item.id === "relationship-credential-cert")?.sourceId, "online-credential");
  const publicResource = profile.resources.find((item) => item.id === "public-role-page")!;
  assert.equal(publicResource.url, "https://example.org/role");
  assert.equal(publicResource.provenance?.strength, "corroborated");
  assert.equal(publicResource.provenance?.observedAt, "2026-01-10");
  assert.equal(validateProfileDocument(profile).valid, true);
  assert.deepEqual(receipt.counts, { careerItems: 3, resources: 3, connections: 4 });
  assert.equal(receipt.graph.connected, true);
});

test("organization and resource connections are retained but do not manufacture career navigation", () => {
  const { profile } = migrateProfileDocument(reference);
  profile.connections = profile.connections.filter((item) => (item.sourceId === "integration-lead" && item.targetId === "fictional-studio") || item.sourceId === "online-credential");
  assert.equal(validateProfileDocument(profile).valid, true);
  assert.equal(analyzeGraphHealth(profile).connected, false);
  assert.equal(analyzeGraphHealth(profile).connectedComponents.length, 3);
});

test("private reference locators and source labels are withheld and explicitly reported", () => {
  const { profile, receipt } = migrateProfileDocument(reference);
  const privateResource = profile.resources.find((item) => item.id === "private-source")!;
  assert.equal(privateResource.kind, "career-note");
  assert.equal(privateResource.availability, "restricted");
  assert.equal(privateResource.provenance?.visibility, "private-reference");
  assert.equal(privateResource.provenance?.sourceLabel, undefined);
  assert.equal(privateResource.url, undefined);
  const exported = JSON.stringify(profile);
  assert.doesNotMatch(exported, /internal\.example\.com|Fictional internal folder|Carpeta interna ficticia/);
  assert.deepEqual(receipt.review.map((item) => item.path), ["evidence[1].source.label", "evidence[1].source.url"]);
  assert.doesNotMatch(JSON.stringify(receipt), /internal\.example\.com|Fictional internal folder/);
});

test("early package v1 profiles upgrade without changing their career content", () => {
  const previous = { ...packageDemo, schemaVersion: "1.0.0" };
  const { profile, receipt } = migrateProfileDocument(previous);
  assert.equal(receipt.sourceFormat, "package-v1");
  assert.deepEqual(profile.careerItems, packageDemo.careerItems);
  assert.deepEqual(profile.resources, packageDemo.resources);
  assert.equal(validateProfileDocument(profile).valid, true);
});

test("early package v1 restricted URLs are withheld rather than carried into v2", () => {
  const previous = structuredClone({ ...packageDemo, schemaVersion: "1.0.0" }) as Record<string, unknown>;
  const resource = (previous.resources as Array<{ url?: string; availability: string }>).find((item) => item.availability === "restricted")!;
  resource.url = "https://internal.example.com/private";
  const { profile, receipt } = migrateProfileDocument(previous);
  assert.equal(profile.resources.find((item) => item.availability === "restricted")?.url, undefined);
  assert.equal(receipt.review.length, 1);
  assert.doesNotMatch(JSON.stringify(profile), /internal\.example\.com/);
});

test("early package v1 unknown private fields cannot ride into the public profile", () => {
  const previous = structuredClone({ ...packageDemo, schemaVersion: "1.0.0" }) as Record<string, unknown>;
  const resource = (previous.resources as Array<Record<string, unknown>>)[0];
  resource.internalFile = "C:/fictional/private-note.pdf";
  assert.throws(() => migrateProfileDocument(previous), /Invalid package v1 profile at: resources\.0/);
});

test("invalid links, ambiguous shapes, and current profiles are not silently imported", () => {
  const broken = structuredClone(reference);
  const claim = (broken.claims as Array<{ evidenceIds: string[] }>)[0];
  claim.evidenceIds = ["missing-record"];
  assert.throws(() => migrateProfileDocument(broken), /non-reciprocal evidence link/);
  assert.throws(() => migrateProfileDocument({ schemaVersion: "1.0.0" }), /Unknown v1 profile shape/);
  assert.throws(() => migrateProfileDocument(packageDemo), /already v2/);
  assert.equal(validateProfileDocument(reference).valid, false);
});

test("CLI migration previews without writes, emits a review receipt, and refuses overwrites", async () => {
  const directory = await mkdtemp(join(tmpdir(), "resumilio-migration-test-"));
  const sourcePath = resolve("tests/fixtures/reference-v1-fictional.json");
  const cli = resolve("node_modules/tsx/dist/cli.mjs");
  const outputPath = join(directory, "imported.json");
  const run = (...args: string[]) => spawnSync(process.execPath, [cli, resolve("core/cli.ts"), "migrate", sourcePath, ...args], { encoding: "utf8" });
  try {
    const preview = run();
    assert.equal(preview.status, 0, preview.stderr);
    assert.equal(JSON.parse(preview.stdout).written, false);
    assert.deepEqual(await readdir(directory), []);
    const write = run("--out", outputPath);
    assert.equal(write.status, 0, write.stderr);
    assert.equal(JSON.parse(write.stdout).written, true);
    assert.equal(JSON.parse(await readFile(outputPath, "utf8")).schemaVersion, "2.0.0");
    assert.equal(JSON.parse(await readFile(`${outputPath}.migration-report.json`, "utf8")).review.length, 2);
    const again = run("--out", outputPath);
    assert.notEqual(again.status, 0);
    assert.match(again.stderr, /nothing was overwritten/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
