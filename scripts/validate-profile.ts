import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { validateProfileDocument } from "../src/validation.ts";

const file = resolve(process.argv[2] ?? "profiles/daniel.json");
const document = JSON.parse(await readFile(file, "utf8"));
const result = validateProfileDocument(document);

if (!result.valid) {
  console.error(JSON.stringify({ file, valid: false, errors: result.errors }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ file, valid: true, claims: document.claims.length, evidence: document.evidence.length, locales: document.profile.locales }, null, 2));
}

