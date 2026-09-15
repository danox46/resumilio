import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, (value) => value.slice(1)));
const ignoredDirectories = new Set([".git", ".astro", ".playwright-cli", ".wrangler", "node_modules", "coverage", "dist", "site-dist", "output", "qa-artifacts"]);
const ignoredFiles = new Set(["package-lock.json"]);
const forbiddenExtensions = new Set([".pdf", ".doc", ".docx", ".rtf", ".odt", ".p12", ".pfx", ".pem", ".key"]);
const textExtensions = new Set([".astro", ".css", ".html", ".js", ".json", ".md", ".mjs", ".ts", ".tsx", ".txt", ".yaml", ".yml"]);
const allowedEmails = new Set(["daniel@danienremoto.com"]);

const signatures = [
  { label: "local user path", pattern: new RegExp(["C:", "\\\\", "Users", "\\\\"].join(""), "i") },
  { label: "internal dashboard host", pattern: new RegExp(["codex-control", "-plane-pilot"].join(""), "i") },
  { label: "private key material", pattern: new RegExp(["-----BEGIN ", "PRIVATE KEY-----"].join(""), "i") },
  { label: "authorization secret", pattern: new RegExp(["Bear", "er\\s+[A-Za-z0-9._-]{16,}"].join(""), "i") },
  { label: "telephone URI", pattern: new RegExp(["te", "l:"].join(""), "i") },
  { label: "international telephone number", pattern: /\+[1-9][0-9\s().-]{8,}[0-9]/ },
];

async function filesUnder(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(path));
    else if (!ignoredFiles.has(entry.name)) files.push(path);
  }
  return files;
}

const findings: Array<{ file: string; issue: string }> = [];
const files = await filesUnder(root);

for (const file of files) {
  const name = relative(root, file).replaceAll("\\", "/");
  if (forbiddenExtensions.has(extname(file).toLowerCase())) {
    findings.push({ file: name, issue: "private or credential-bearing binary type" });
    continue;
  }
  if (!textExtensions.has(extname(file).toLowerCase())) continue;
  const content = await readFile(file, "utf8").catch(() => "");
  for (const signature of signatures) if (signature.pattern.test(content)) findings.push({ file: name, issue: signature.label });
  for (const match of content.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)) {
    if (!allowedEmails.has(match[0].toLowerCase())) findings.push({ file: name, issue: `unapproved email ${match[0]}` });
  }
}

if (findings.length) {
  console.error(JSON.stringify({ safe: false, findings }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ safe: true, filesScanned: files.length, forbiddenArtifacts: 0, unapprovedEmails: 0 }, null, 2));
}
