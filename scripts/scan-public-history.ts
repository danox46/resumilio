import { execFileSync } from "node:child_process";
import { extname } from "node:path";

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

const commits = execFileSync("git", ["rev-list", "--all"], { encoding: "utf8" }).trim().split(/\r?\n/).filter(Boolean);
const blobs = new Map<string, Set<string>>();

for (const commit of commits) {
  const entries = execFileSync("git", ["ls-tree", "-r", "-z", commit], { encoding: "utf8" }).split("\0").filter(Boolean);
  for (const entry of entries) {
    const match = entry.match(/^\d+ blob ([a-f0-9]+)\t(.+)$/);
    if (!match) continue;
    const [, hash, path] = match;
    if (!blobs.has(hash)) blobs.set(hash, new Set());
    blobs.get(hash)?.add(path);
  }
}

const findings: Array<{ object: string; file: string; issue: string }> = [];
for (const [hash, paths] of blobs) {
  for (const path of paths) {
    if (ignoredFiles.has(path.split("/").at(-1) ?? path)) continue;
    const extension = extname(path).toLowerCase();
    if (forbiddenExtensions.has(extension)) {
      findings.push({ object: hash, file: path, issue: "private or credential-bearing binary type" });
      continue;
    }
    if (!textExtensions.has(extension)) continue;
    const content = execFileSync("git", ["cat-file", "blob", hash], { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
    for (const signature of signatures) {
      if (signature.pattern.test(content)) findings.push({ object: hash, file: path, issue: signature.label });
    }
    for (const match of content.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)) {
      if (!allowedEmails.has(match[0].toLowerCase())) findings.push({ object: hash, file: path, issue: `unapproved email ${match[0]}` });
    }
  }
}

if (findings.length) {
  console.error(JSON.stringify({ safe: false, commitsScanned: commits.length, uniqueBlobsScanned: blobs.size, findings }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ safe: true, commitsScanned: commits.length, uniqueBlobsScanned: blobs.size, forbiddenArtifacts: 0, unapprovedEmails: 0 }, null, 2));
}
