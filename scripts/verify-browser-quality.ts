import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, isAbsolute, join, normalize, resolve } from "node:path";
import { chromium } from "playwright-core";

const chromeCandidates = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter((value): value is string => Boolean(value));
const chromePath = chromeCandidates.find(existsSync);
if (!chromePath) throw new Error("Chrome was not found. Set CHROME_PATH to run browser QA.");

const mimeTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8", ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".jpg": "image/jpeg", ".json": "application/json; charset=utf-8", ".mp4": "video/mp4", ".svg": "image/svg+xml", ".txt": "text/plain; charset=utf-8", ".webp": "image/webp", ".xml": "application/xml; charset=utf-8",
};
const server = createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\//, "");
  const candidate = normalize(join("site-dist", relative));
  const path = existsSync(candidate) && !extname(candidate) ? join(candidate, "index.html") : candidate;
  if (!path.startsWith(normalize("site-dist")) || !existsSync(path)) return void response.writeHead(404).end("Not found");
  response.writeHead(200, { "content-type": mimeTypes[extname(path)] ?? "application/octet-stream" });
  response.end(readFileSync(path));
});

await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
if (!address || typeof address === "string") throw new Error("Could not start the browser QA server.");
const origin = `http://127.0.0.1:${address.port}`;
const requestedOutputDirectory = process.env.RESUMILIO_QA_OUTPUT_DIR;
const outputDirectory = requestedOutputDirectory
  ? isAbsolute(requestedOutputDirectory) ? requestedOutputDirectory : resolve(requestedOutputDirectory)
  : join(tmpdir(), "resumilio-phase5-qa");
rmSync(outputDirectory, { recursive: true, force: true });
mkdirSync(outputDirectory, { recursive: true });

const viewports = [
  { name: "watch", width: 240, height: 240 },
  { name: "small-mobile", width: 320, height: 568 },
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 1024 },
  { name: "full-hd", width: 1920, height: 1080 },
  { name: "four-k", width: 3840, height: 2160 },
];

const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ["--no-sandbox"] });
const report = { viewports: [] as Array<Record<string, unknown>>, keyboard: false, avatarReactions: false, avatarPlayback: false, assistiveTechnologyStructureSmoke: false, reducedMotion: false, firstPartyRequests: 0, externalRequests: [] as string[], evidencePageScriptRequests: 0 };
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1, reducedMotion: "reduce" });
    const page = await context.newPage();
    const requests: string[] = [];
    page.on("request", (request) => requests.push(request.url()));
    await page.goto(`${origin}/`, { waitUntil: "networkidle" });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow > 1) throw new Error(`${viewport.name} has ${overflow}px of horizontal overflow.`);
    const visibleTargets = await page.locator("button:visible, a:visible, input:visible, select:visible").count();
    if (visibleTargets === 0) throw new Error(`${viewport.name} exposes no interactive targets.`);
    const screenshot = join(outputDirectory, `${viewport.width}x${viewport.height}-${viewport.name}.png`);
    await page.screenshot({ path: screenshot, fullPage: true });
    const external = requests.filter((url) => new URL(url).origin !== origin);
    report.externalRequests.push(...external);
    report.firstPartyRequests += requests.length - external.length;
    report.viewports.push({ ...viewport, overflow, visibleTargets, screenshot });

    if (viewport.name === "mobile") {
      const firstClaim = page.locator(".claim-node:not(:disabled)").first();
      await firstClaim.focus();
      const before = await firstClaim.getAttribute("data-claim-id");
      await page.keyboard.press("ArrowDown");
      const active = page.locator(".claim-node:focus");
      const after = await active.getAttribute("data-claim-id");
      const pressed = await active.getAttribute("aria-pressed");
      const outlineStyle = await active.evaluate((element) => getComputedStyle(element).outlineStyle);
      if (!before || !after || before === after || pressed !== "true" || outlineStyle === "none") throw new Error("Directional-key focus, selection, or visible focus failed.");
      report.keyboard = true;
      const avatar = page.locator(".avatar-guide");
      if (await avatar.getAttribute("data-avatar-state") !== "nod") throw new Error("Avatar did not acknowledge career-map focus.");
      await page.locator(".search-field input").fill("HubSpot");
      await page.locator(".search-controls").press("Enter");
      if (await avatar.getAttribute("data-avatar-state") !== "smile") throw new Error("Avatar did not react to a search.");
      report.avatarReactions = true;
      report.assistiveTechnologyStructureSmoke = await page.locator("main").count() === 1
        && await page.locator('[role="search"]').count() === 1
        && await page.locator('[aria-describedby="graph-help"]').count() === 1
        && await page.locator('[aria-live="polite"]').count() >= 1;
      report.reducedMotion = await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
    }
    await context.close();
  }

  const context = await browser.newContext();
  const page = await context.newPage();
  const scriptRequests: string[] = [];
  page.on("request", (request) => { if (request.resourceType() === "script") scriptRequests.push(request.url()); });
  await page.goto(`${origin}/evidence/claim-professional-ai-text-completion/`, { waitUntil: "networkidle" });
  report.evidencePageScriptRequests = scriptRequests.length;
  await context.close();

  const motionContext = await browser.newContext({ reducedMotion: "no-preference" });
  const motionPage = await motionContext.newPage();
  await motionPage.goto(`${origin}/`, { waitUntil: "networkidle" });
  await motionPage.mouse.move(10, 10);
  const video = motionPage.locator(".avatar-video");
  await motionPage.waitForFunction(() => {
    const element = document.querySelector<HTMLVideoElement>(".avatar-video");
    return Boolean(element && !element.paused && element.currentTime > 0.1);
  });
  await motionPage.locator(".claim-node:not(:disabled)").first().click();
  if (await motionPage.locator(".avatar-guide").getAttribute("data-avatar-state") !== "nod" || !String(await video.getAttribute("src")).endsWith("daniel-nod.mp4")) throw new Error("Nod playback did not replace idle after selection.");
  await motionPage.locator(".constellation > .claim-detail .button--secondary").click();
  if (await motionPage.locator(".avatar-guide").getAttribute("data-avatar-state") !== "smile" || !String(await video.getAttribute("src")).endsWith("daniel-smile.mp4")) throw new Error("Smile playback did not replace nod after recommendation.");
  report.avatarPlayback = true;
  await motionContext.close();

  if (report.externalRequests.length > 0) throw new Error(`External runtime requests detected: ${report.externalRequests.join(", ")}`);
  if (!report.keyboard || !report.avatarReactions || !report.avatarPlayback || !report.assistiveTechnologyStructureSmoke || !report.reducedMotion) throw new Error("One or more interaction or accessibility structure smoke checks failed.");
  if (report.evidencePageScriptRequests > 0) throw new Error("Static evidence pages loaded JavaScript.");
  writeFileSync(join(outputDirectory, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
