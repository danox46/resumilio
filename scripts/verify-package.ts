import { execSync } from "node:child_process";

const output = execSync("npm pack --dry-run --json", { encoding: "utf8" });
const result = JSON.parse(output) as Array<{ files: Array<{ path: string }> }>;
const files = result[0]?.files.map((entry) => entry.path) ?? [];
const required = ["dist/core/cli.js", "dist/core/mcp-server.js", "dist/ui/Constellation.js", "schemas/profile.v1.schema.json", "starter/site/resumilio.json", "skills/resumilio-authoring/SKILL.md"];
const missing = required.filter((path) => !files.includes(path));
const forbidden = files.filter((path) => /daniel|avatar\/.+\.(mp4|webp|mov)/i.test(path));
if (missing.length || forbidden.length) throw new Error(`Packed package contract failed. Missing: ${missing.join(", ")}. Forbidden: ${forbidden.join(", ")}.`);
console.log(JSON.stringify({ ok: true, fileCount: files.length, required }, null, 2));
