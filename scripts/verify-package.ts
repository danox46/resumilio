import { execSync } from "node:child_process";

const output = execSync("npm pack --dry-run --json", { encoding: "utf8" });
const result = JSON.parse(output) as Array<{ files: Array<{ path: string }> }>;
const files = result[0]?.files.map((entry) => entry.path) ?? [];
const companionAssets = [
  ...["idle", "blink", "smile", "guide-wide", "guide-mobile"].map((state) => `starter/site/public/images/resumilio-cat-${state}.png`),
  "starter/site/public/images/resumilio-cat-idle-sheet.png",
  "starter/site/public/images/resumilio-cat-smile-sheet.png",
];
const required = ["dist/core/cli.js", "dist/core/mcp-server.js", "dist/core/migration.js", "dist/ui/Constellation.js", "schemas/profile.v1.schema.json", "schemas/profile.v2.schema.json", "docs/migration-v2.md", "starter/site/resumilio.json", ...companionAssets, "skills/resumilio-authoring/SKILL.md"];
const missing = required.filter((path) => !files.includes(path));
const forbidden = files.filter((path) => /daniel|avatar\/.+\.(mp4|webp|mov)/i.test(path));
if (missing.length || forbidden.length) throw new Error(`Packed package contract failed. Missing: ${missing.join(", ")}. Forbidden: ${forbidden.join(", ")}.`);
console.log(JSON.stringify({ ok: true, fileCount: files.length, required }, null, 2));
