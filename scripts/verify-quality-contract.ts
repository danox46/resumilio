import { gzipSync } from "node:zlib";
import { readFileSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";

const browserSource = readFileSync("src/components/EvidenceExplorer.tsx", "utf8");
const browserSiteSource = readFileSync("src/site.ts", "utf8");
const englishPage = readFileSync("src/pages/index.astro", "utf8");
const spanishPage = readFileSync("src/pages/es/index.astro", "utf8");
const styles = readFileSync("src/styles/global.css", "utf8");

const forbiddenRuntimeApis = ["fetch(", "XMLHttpRequest", "WebSocket", "sendBeacon", "localStorage", "indexedDB", "document.cookie"];
for (const api of forbiddenRuntimeApis) {
  if (`${browserSource}\n${browserSiteSource}`.includes(api)) throw new Error(`Browser source uses forbidden runtime API: ${api}`);
}
if (/\bprocess\.env\b/.test(browserSiteSource)) throw new Error("Browser-imported site helpers must not reference a bare Node process global.");

for (const [label, page] of [["English", englishPage], ["Spanish", spanishPage]] as const) {
  if (!page.includes("client:load")) throw new Error(`${label} experience must hydrate on load so the primary constellation interaction is immediately available.`);
}

const requiredAccessibilitySignals = [
  "prefers-reduced-motion: reduce",
  ":focus-visible",
  ".sr-only",
];
for (const signal of requiredAccessibilitySignals) {
  if (!styles.includes(signal)) throw new Error(`Missing accessibility signal: ${signal}`);
}

for (const key of ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"]) {
  if (!browserSource.includes(`\"${key}\"`)) throw new Error(`Missing keyboard/D-pad key: ${key}`);
}
if (!browserSource.includes("sessionStorage")) throw new Error("Session-local discovery storage is missing.");

const walk = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = join(directory, entry.name);
  return entry.isDirectory() ? walk(path) : [path];
});

const javascript = walk("site-dist/assets").filter((path) => extname(path) === ".js");
if (javascript.length === 0) throw new Error("No interactive JavaScript bundle was emitted.");
const totalGzipBytes = javascript.reduce((total, path) => total + gzipSync(readFileSync(path)).byteLength, 0);
const budgetBytes = 90 * 1024;
if (totalGzipBytes > budgetBytes) throw new Error(`Interactive JavaScript is ${totalGzipBytes} bytes gzip; budget is ${budgetBytes}.`);

const evidenceHtml = walk("site-dist/evidence").filter((path) => path.endsWith("index.html"));
for (const path of evidenceHtml) {
  const html = readFileSync(path, "utf8");
  if (/<script[^>]+type="module"/i.test(html)) throw new Error(`Static evidence page loads interactive JavaScript: ${path}`);
}

console.log(JSON.stringify({
  keyboardKeys: 6,
  storage: "session-only",
  forbiddenRuntimeApis: 0,
  javascriptBundles: javascript.length,
  javascriptGzipBytes: totalGzipBytes,
  staticEvidencePages: evidenceHtml.length,
}, null, 2));
