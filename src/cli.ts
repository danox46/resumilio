#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import type { Locale } from "./profile.js";
import { analyzeConstellationGraph } from "./graph-health.js";
import { buildDeploymentArtifacts, buildPreview, renderHtml, renderMarkdown } from "./rendering.js";
import { guidanceFor, ingestDocument, initializeWorkspace, loadValidProfile, type ExperienceLevel } from "./workspace.js";
import { RESUMILIO_VERSION } from "./version.js";

const args = process.argv.slice(2);
const command = args.shift() ?? "help";

function option(name: string, fallback?: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  const value = args[index + 1];
  args.splice(index, value === undefined ? 1 : 2);
  return value ?? fallback;
}

function localeOption(): Locale {
  const value = option("--locale", "en");
  if (value !== "en" && value !== "es") throw new Error("--locale must be en or es");
  return value;
}

function profileOption(): string {
  const explicit = option("--profile");
  return resolve(explicit ?? args.shift() ?? "resumilio.json");
}

function printHelp(): void {
  console.log(`Resumilio — evidence-backed living resumes

Commands:
  init [directory] [--level nontechnical|intermediate|advanced]
  ingest <input.json> [--profile resumilio.json]
  validate [profile]
  preview [profile] [--output .resumilio/preview] [--locale en|es]
  export [profile] [--format json|markdown|html] [--output file]
  doctor [profile]
  deploy [profile] [--output .resumilio/deploy] [--locale en|es]

No model key is required.`);
}

async function run(): Promise<void> {
  if (command === "--version" || command === "-v" || command === "version") {
    console.log(RESUMILIO_VERSION);
    return;
  }
  if (command === "help" || command === "--help" || command === "-h") return printHelp();
  if (command === "init") {
    const level = option("--level", "nontechnical") as ExperienceLevel;
    if (!(["nontechnical", "intermediate", "advanced"] as string[]).includes(level)) throw new Error("Unknown experience level.");
    const directory = args.shift() ?? ".";
    const created = await initializeWorkspace(directory, level);
    const guidance = guidanceFor(level);
    console.log(JSON.stringify({ ok: true, command, mode: guidance.label, ...created, next: guidance.next }, null, 2));
    return;
  }

  if (command === "ingest") {
    const input = args.shift();
    if (!input) throw new Error("ingest requires an input JSON file");
    const profile = await ingestDocument(input, option("--profile", "resumilio.json")!);
    console.log(JSON.stringify({ ok: true, command, claims: profile.claims.length, evidence: profile.evidence.length }, null, 2));
    return;
  }
  if (command === "validate") {
    const profilePath = profileOption();
    const profile = await loadValidProfile(profilePath);
    console.log(JSON.stringify({
      ok: true,
      command,
      profile: profile.profile.id,
      claims: profile.claims.length,
      evidence: profile.evidence.length,
      graphHealth: analyzeConstellationGraph(profile),
    }, null, 2));
    return;
  }
  if (command === "preview") {
    const locale = localeOption();
    const output = option("--output", ".resumilio/preview")!;
    const profilePath = profileOption();
    const path = await buildPreview(await loadValidProfile(profilePath), output, locale);
    console.log(JSON.stringify({ ok: true, command, output: path, locale }, null, 2));
    return;
  }
  if (command === "export") {
    const format = option("--format", "json")!;
    const output = resolve(option("--output", `.resumilio/export/profile.${format === "markdown" ? "md" : format}`)!);
    const locale = localeOption();
    const profilePath = profileOption();
    const profile = await loadValidProfile(profilePath);
    if (!['json', 'markdown', 'html'].includes(format)) throw new Error("--format must be json, markdown, or html");
    const content = format === "json" ? `${JSON.stringify(profile, null, 2)}\n` : format === "markdown" ? renderMarkdown(profile, locale) : renderHtml(profile, locale);
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, content, "utf8");
    console.log(JSON.stringify({ ok: true, command, format, output }, null, 2));
    return;
  }
  if (command === "doctor") {
    const profilePath = profileOption();
    const checks: Array<{ check: string; ok: boolean; detail: string }> = [];
    checks.push({ check: "node", ok: Number(process.versions.node.split(".")[0]) >= 22, detail: process.version });
    const profile = await loadValidProfile(profilePath);
    checks.push({ check: "profile", ok: true, detail: profile.profile.id });
    const graphHealth = analyzeConstellationGraph(profile);
    checks.push({
      check: "constellation-navigation",
      ok: graphHealth.navigationGuaranteed,
      detail: `${graphHealth.minimumReachableClaims}/${graphHealth.claimCount} claims reachable from every center via ${graphHealth.traversalStrategy}`,
    });
    checks.push({ check: "model-key", ok: true, detail: "not required" });
    const ok = checks.every((check) => check.ok);
    console.log(JSON.stringify({ ok, command, checks }, null, 2));
    if (!ok) process.exitCode = 1;
    return;
  }
  if (command === "deploy") {
    const locale = localeOption();
    const output = option("--output", ".resumilio/deploy")!;
    const profilePath = profileOption();
    const artifacts = await buildDeploymentArtifacts(await loadValidProfile(profilePath), output, locale);
    console.log(JSON.stringify({ ok: true, command, mode: "local-artifacts-only", artifacts }, null, 2));
    return;
  }
  throw new Error(`Unknown command: ${command}`);
}

run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
