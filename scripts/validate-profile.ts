import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { analyzeGraphHealth } from "../core/graph.js";
import type { ResumilioProfile } from "../core/profile.js";
import { validateProfileDocument } from "../core/validation.js";

const path = resolve(process.argv[2] ?? "profiles/demo.json");
const value = JSON.parse(await readFile(path, "utf8"));
const result = validateProfileDocument(value);
if (!result.valid) {
  console.error(result.errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ valid: true, warnings: result.warnings, graphHealth: analyzeGraphHealth(value as ResumilioProfile) }, null, 2));
}
