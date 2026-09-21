#!/usr/bin/env node
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { analyzeGraphHealth } from "./graph.js";
import { installCodexSkill, initializeWorkspace, loadProfile } from "./workspace.js";
import { RESUMILIO_VERSION } from "./version.js";

const args = process.argv.slice(2);
const command = args.shift() ?? "help";

function help(): void {
  console.log(`Resumilio — your career, in motion.

Commands:
  init <directory>       Create a complete Astro resume project
  validate [profile]     Validate content and graph health
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
