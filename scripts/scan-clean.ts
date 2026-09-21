import { execFileSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { extname, resolve } from "node:path";

const forbidden = [
  /daniel rosales/i,
  /danieltalking/i,
  /daniel@danienremoto/i,
  /profile(?:s)?[\\/]daniel/i,
  /daniel-(?:idle|waiting|nod|smile|guide)/i,
];
const binaryExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".mp4", ".mov", ".gif", ".tgz"]);

async function walk(path: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(path, { withFileTypes: true })) {
    if (["node_modules", "dist", ".git", ".astro"].includes(entry.name)) continue;
    const target = resolve(path, entry.name);
    if (entry.isDirectory()) files.push(...await walk(target)); else files.push(target);
  }
  return files;
}

const root = resolve(".");
const files = await walk(root);
const failures: string[] = [];
for (const file of files) {
  if (file.endsWith("scripts\\scan-clean.ts") || file.endsWith("scripts/scan-clean.ts")) continue;
  if (binaryExtensions.has(extname(file).toLowerCase())) continue;
  const content = await readFile(file, "utf8");
  for (const pattern of forbidden) if (pattern.test(content)) failures.push(`${file}: ${pattern}`);
}
if (files.some((file) => /public[\\/]media[\\/]avatar/i.test(file) && /\.(mp4|mov|webp|jpg|png)$/i.test(file))) failures.push("Personal avatar media directory is not allowed.");
if (failures.length) { console.error(failures.join("\n")); process.exitCode = 1; }
else console.log(JSON.stringify({ clean: true, filesScanned: files.length }, null, 2));

if (process.env.RESUMILIO_SCAN_HISTORY === "1") {
  const objects = execFileSync("git", ["rev-list", "--objects", "--all"], {
    encoding: "utf8",
    maxBuffer: 100 * 1024 * 1024,
  });
  const historyObjects = objects
    .split(/\r?\n/)
    .map((line) => {
      const [objectId, ...pathParts] = line.trim().split(/\s+/);
      return { objectId, path: pathParts.join(" ") };
    })
    .filter(({ objectId, path }) => Boolean(objectId) && path !== "scripts/scan-clean.ts")
    .filter(({ objectId }) => execFileSync("git", ["cat-file", "-t", objectId], { encoding: "utf8" }).trim() === "blob");
  for (const { objectId } of historyObjects) {
    const size = Number(execFileSync("git", ["cat-file", "-s", objectId], { encoding: "utf8" }).trim());
    if (!Number.isFinite(size) || size > 5 * 1024 * 1024) continue;
    const content = execFileSync("git", ["cat-file", "blob", objectId], {
      encoding: "utf8",
      maxBuffer: 6 * 1024 * 1024,
    });
    const hit = forbidden.find((pattern) => pattern.test(content));
    if (hit) {
      console.error(`Forbidden personal content found in Git history blob ${objectId}: ${hit}`);
      process.exitCode = 1;
      break;
    }
  }
}
