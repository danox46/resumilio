import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import lighthouse from "lighthouse";
import * as chromeLauncher from "chrome-launcher";

const mimeTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};

const server = createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\//, "");
  const candidate = normalize(join("site-dist", relative));
  const path = existsSync(candidate) && !extname(candidate) ? join(candidate, "index.html") : candidate;
  if (!path.startsWith(normalize("site-dist")) || !existsSync(path)) {
    response.writeHead(404).end("Not found");
    return;
  }
  response.writeHead(200, {
    "content-type": mimeTypes[extname(path)] ?? "application/octet-stream",
    "cache-control": path.includes(`${join("site-dist", "assets")}`) ? "public, max-age=31536000, immutable" : "public, max-age=0, must-revalidate",
  });
  response.end(readFileSync(path));
});

await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
if (!address || typeof address === "string") throw new Error("Could not start the quality server.");

let chrome: Awaited<ReturnType<typeof chromeLauncher.launch>> | undefined;
try {
  chrome = await chromeLauncher.launch({
    chromePath: process.env.CHROME_PATH,
    chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu"],
  });
  const samples: Array<{ scores: Record<string, number>; largestContentfulPaintMs: number; cumulativeLayoutShift: number }> = [];
  for (let run = 0; run < 3; run += 1) {
    const result = await lighthouse(`http://127.0.0.1:${address.port}/`, {
      port: chrome.port,
      output: "json",
      logLevel: "error",
      onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
      formFactor: "mobile",
      screenEmulation: { mobile: true, width: 390, height: 844, deviceScaleFactor: 2, disabled: false },
    });
    if (!result) throw new Error("Lighthouse did not return a result.");
    samples.push({
      scores: Object.fromEntries(Object.entries(result.lhr.categories).map(([key, category]) => [key, Math.round((category.score ?? 0) * 100)])),
      largestContentfulPaintMs: Math.round(result.lhr.audits["largest-contentful-paint"].numericValue ?? Number.POSITIVE_INFINITY),
      cumulativeLayoutShift: Number((result.lhr.audits["cumulative-layout-shift"].numericValue ?? Number.POSITIVE_INFINITY).toFixed(4)),
    });
  }

  const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
  const scores = Object.fromEntries(Object.keys(samples[0].scores).map((category) => [category, median(samples.map((sample) => sample.scores[category]))]));
  const largestContentfulPaintMs = median(samples.map((sample) => sample.largestContentfulPaintMs));
  const cumulativeLayoutShift = median(samples.map((sample) => sample.cumulativeLayoutShift));
  const receipt = { runs: samples.length, scores, largestContentfulPaintMs, cumulativeLayoutShift, samples };

  for (const [category, score] of Object.entries(scores)) {
    if (score < 95) throw new Error(`${category} score is ${score}; required minimum is 95.`);
  }
  if (largestContentfulPaintMs >= 2500) throw new Error(`LCP is ${largestContentfulPaintMs}ms; required maximum is below 2500ms.`);
  if (cumulativeLayoutShift >= 0.1) throw new Error(`CLS is ${cumulativeLayoutShift}; required maximum is below 0.1.`);

  console.log(JSON.stringify(receipt, null, 2));
} finally {
  try {
    chrome?.kill();
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "EPERM")) throw error;
  }
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
