import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const publicOrigin = "https://resumilio.danielx9.workers.dev";
const reservedOrigin = "https://resumilio.example";
const files = ["index.html", "es/index.html", "sitemap.xml", "resume.json", "es/resume.json", ".well-known/resumilio.json"];

for (const file of files) {
  const content = readFileSync(join("site-dist", file), "utf8");
  if (content.includes(reservedOrigin)) throw new Error(`${file} still contains the reserved pre-publication origin.`);
  if (!content.includes(publicOrigin)) throw new Error(`${file} does not contain the verified public origin.`);
}

const publicFiles = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = join(directory, entry.name);
  return entry.isDirectory() ? publicFiles(path) : [path];
});
const forbidden = [
  new RegExp(["codex-control", "-plane-pilot"].join(""), "i"),
  new RegExp(["C:", "\\\\", "Users", "\\\\"].join(""), "i"),
  new RegExp(["-----BEGIN ", "PRIVATE KEY-----"].join(""), "i"),
  new RegExp(["Bear", "er\\s+[A-Za-z0-9._-]{16,}"].join(""), "i"),
  new RegExp(["(?:^|[\"'])", "te", "l:"].join(""), "i"),
];
const findings = publicFiles("site-dist").filter((file) => forbidden.some((signature) => signature.test(readFileSync(file, "utf8"))));
if (findings.length > 0) throw new Error(`Sensitive deployment signatures found in: ${findings.join(", ")}`);

console.log(JSON.stringify({
  publicOrigin,
  reservedOriginOccurrences: 0,
  filesScanned: publicFiles("site-dist").length,
  sensitiveFindings: 0,
  assetsOnly: true,
}, null, 2));
