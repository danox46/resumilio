#!/usr/bin/env node
import { spawn } from "node:child_process";
import { readFile, stat, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { analyzeGraphHealth } from "./graph.js";
import { migrateProfileDocument } from "./migration.js";
import { installCodexSkill, initializeWorkspace, loadProfile } from "./workspace.js";
import { RESUMILIO_VERSION } from "./version.js";

const args = process.argv.slice(2);
const command = args.shift() ?? "help";

function help(): void {
  console.log(`Resumilio — your career, in motion.

Commands:
  init <directory>       Create a complete Astro resume project
  validate [profile]     Validate content and graph health
  migrate <profile> [--out <file>]  Preview a v1 import; --out writes v2 plus a review receipt
  preview [directory]    Start the generated project's local preview
  build [directory]      Build static deployment artifacts
  agent install codex    Install the optional Codex authoring skill
  version                Print the package version

Resumilio works without an AI or model key.`);
}

function runNpm(directory: string, script: string): Promise<number> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["run", script], { cwd: resolve(directory), stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => resolvePromise(code ?? 1));
  });
}

async function main(): Promise<void> {
  if (["help", "--help", "-h"].includes(command)) return help();
  if (["version", "--version", "-v"].includes(command)) return console.log(RESUMILIO_VERSION);
  if (command === "init") {
    const directory = args.shift();
    if (!directory) throw new Error("init requires a new project directory.");
    console.log(JSON.stringify({ ok: true, command, ...(await initializeWorkspace(directory)), next: ["npm install", "npm run dev"] }, null, 2));
    return;
  }
  if (command === "validate") {
    const profile = await loadProfile(args.shift() ?? "resumilio.json");
    console.log(JSON.stringify({ ok: true, profile: profile.profile.id, careerItems: profile.careerItems.length, resources: profile.resources.length, graphHealth: analyzeGraphHealth(profile) }, null, 2));
    return;
  }
  if (command === "migrate") {
    const sourceName = args.shift();
    if (!sourceName || (args.length !== 0 && (args.length !== 2 || args[0] !== "--out" || !args[1]))) throw new Error("Usage: resumilio migrate <v1-profile.json> [--out <v2-profile.json>]");
    const sourcePath = resolve(sourceName);
    const source = JSON.parse(await readFile(sourcePath, "utf8")) as unknown;
    const result = migrateProfileDocument(source);
    if (!args.length) {
      console.log(JSON.stringify({ ok: true, written: false, receipt: result.receipt }, null, 2));
      return;
    }
    const outputPath = resolve(args[1]);
    const reportPath = `${outputPath}.migration-report.json`;
    if (sourcePath === outputPath || sourcePath === reportPath) throw new Error("Migration output must differ from its source.");
    if (await stat(outputPath).catch(() => undefined) || await stat(reportPath).catch(() => undefined)) throw new Error("Migration output or review receipt already exists; nothing was overwritten.");
    await writeFile(outputPath, `${JSON.stringify(result.profile, null, 2)}\n`, { flag: "wx" });
    try {
      await writeFile(reportPath, `${JSON.stringify(result.receipt, null, 2)}\n`, { flag: "wx" });
    } catch (error) {
      await unlink(outputPath);
      throw error;
    }
    console.log(JSON.stringify({ ok: true, written: true, receipt: result.receipt }, null, 2));
    return;
  }
  if (command === "preview" || command === "build") {
    const code = await runNpm(args.shift() ?? ".", command === "preview" ? "dev" : "build");
    if (code) process.exitCode = code;
    return;
  }
  if (command === "agent" && args[0] === "install" && args[1] === "codex") {
    console.log(JSON.stringify({ ok: true, command: "agent install codex", destination: await installCodexSkill() }, null, 2));
    return;
  }
  throw new Error(`Unknown command: ${command}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
