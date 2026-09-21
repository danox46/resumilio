import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ResumilioProfile } from "./profile.js";
import { assertValidProfile } from "./validation.js";

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
const packageRoot = [resolve(moduleDirectory, ".."), resolve(moduleDirectory, "../..")]
  .find((candidate) => existsSync(resolve(candidate, "starter", "site"))) ?? resolve(moduleDirectory, "..");

export async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(resolve(path), "utf8"));
}

export async function writeJson(path: string, value: unknown): Promise<void> {
  const target = resolve(path);
  await mkdir(dirname(target), { recursive: true });
  const temporary = `${target}.tmp-${process.pid}`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  const { rename } = await import("node:fs/promises");
  await rename(temporary, target);
}

export async function loadProfile(path: string): Promise<ResumilioProfile> {
  const value = await readJson(path);
  assertValidProfile(value);
  return value;
}

export async function initializeWorkspace(directory: string): Promise<{ directory: string; profile: string; config: string; skill: string }> {
  const target = resolve(directory);
  if (existsSync(target)) throw new Error(`Target already exists: ${target}`);
  await cp(resolve(packageRoot, "starter", "site"), target, { recursive: true, errorOnExist: true, force: false });
  return {
    directory: target,
    profile: resolve(target, "resumilio.json"),
    config: resolve(target, "resumilio.config.json"),
    skill: resolve(target, ".resumilio", "skills", "resumilio-authoring", "SKILL.md"),
  };
}

export async function installCodexSkill(): Promise<string> {
  const base = process.env.CODEX_HOME ? resolve(process.env.CODEX_HOME) : resolve(process.env.USERPROFILE ?? process.cwd(), ".codex");
  const destination = resolve(base, "skills", "resumilio-authoring");
  await mkdir(dirname(destination), { recursive: true });
  await cp(resolve(packageRoot, "skills", "resumilio-authoring"), destination, { recursive: true, force: true });
  return destination;
}
