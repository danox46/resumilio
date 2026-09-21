import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { chromium, type Page } from "playwright";

async function assertCompanionFaceClear(page: Page, label: string) {
  const companion = await page.locator(".resumilio-companion").boundingBox();
  if (!companion) throw new Error(`${label} companion is missing.`);
  const face = {
    x: companion.x + companion.width * 0.2,
    y: companion.y + companion.height * 0.08,
    width: companion.width * 0.6,
    height: companion.height * 0.47,
  };
  for (const node of await page.locator(".preview-node").all()) {
    const box = await node.boundingBox();
    if (!box) continue;
    const overlap = !(box.x > face.x + face.width || box.x + box.width < face.x || box.y > face.y + face.height || box.y + box.height < face.y);
    if (overlap) throw new Error(`${label} preview node overlaps the companion face-safe region.`);
  }
}

const root = normalize(join(process.cwd(), "site", "dist"));
const types: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".txt": "text/plain" };
const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
    let file = join(root, pathname);
    if ((await stat(file).catch(() => undefined))?.isDirectory()) file = join(file, "index.html");
    if (!(await stat(file).catch(() => undefined))) file = join(root, pathname, "index.html");
    if (!normalize(file).startsWith(root)) throw new Error("Invalid path");
    response.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" });
    response.end(await readFile(file));
  } catch {
    response.writeHead(404); response.end("Not found");
  }
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
if (!address || typeof address === "string") throw new Error("Unable to start QA server.");
const origin = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({ headless: true });
try {
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await desktop.goto(origin, { waitUntil: "networkidle" });
  await desktop.waitForTimeout(1400);
  if (await desktop.locator(".preview-node").count() !== 5) throw new Error("Desktop must render five preview nodes.");
  const sprites = desktop.locator(".companion-sprite");
  if (await sprites.count() !== 6) throw new Error("Companion must preload all six behavior sheets.");
  const spriteSizes = await sprites.evaluateAll((elements) => elements.map((element) => ({ width: (element as HTMLImageElement).naturalWidth, height: (element as HTMLImageElement).naturalHeight })));
  if (spriteSizes.some(({ width, height }) => width !== 1024 || height !== 1024)) throw new Error("A companion sprite sheet has unexpected dimensions.");
  const idleSprite = desktop.locator(".companion-sprite--idle");
  const idleTiming = await idleSprite.evaluate((element) => ({ name: getComputedStyle(element).animationName, duration: parseFloat(getComputedStyle(element).animationDuration) }));
  if (idleTiming.name !== "companion-frames" || Math.abs(idleTiming.duration - 16 / 14) > 0.001) throw new Error("Idle companion is not playing sixteen drawings at 14 fps.");
  await assertCompanionFaceClear(desktop, "Desktop");
  const before = await desktop.locator(".focus-node h2").innerText();
  await desktop.locator(".preview-node").first().click();
  if (await desktop.locator(".companion-sprite--guide-wide").evaluate((element) => getComputedStyle(element).animationName) !== "companion-frames") throw new Error("Desktop selection did not trigger the wide guidance sheet.");
  const after = await desktop.locator(".focus-node h2").innerText();
  if (before === after) throw new Error("Node selection did not promote a new career item.");
  await desktop.getByPlaceholder("Search roles, skills, or projects").fill("Field Guide");
  await desktop.getByRole("button", { name: "Search" }).click();
  if (!/Field Guide/.test(await desktop.locator(".focus-node h2").innerText())) throw new Error("Search did not promote its matching item.");
  if (await desktop.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)) throw new Error("Desktop has horizontal overflow.");

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobile.goto(`${origin}/demo/`, { waitUntil: "networkidle" });
  await mobile.waitForTimeout(1400);
  if (await mobile.locator(".preview-node").count() !== 4) throw new Error("Mobile must render four preview nodes.");
  await assertCompanionFaceClear(mobile, "Mobile");
  await mobile.locator(".preview-node").first().click();
  if (await mobile.locator(".companion-sprite--guide-mobile").evaluate((element) => getComputedStyle(element).animationName) !== "companion-frames") throw new Error("Mobile selection did not trigger the downward guidance sheet.");
  const focus = await mobile.locator(".focus-node").boundingBox();
  if (!focus) throw new Error("Mobile focus node is missing.");
  for (const node of await mobile.locator(".preview-node").all()) {
    const box = await node.boundingBox();
    if (!box) continue;
    const overlap = !(box.x + box.width < focus.x || focus.x + focus.width < box.x || box.y + box.height < focus.y || focus.y + focus.height < box.y);
    if (overlap) throw new Error("A mobile preview node overlaps the focus node.");
  }
  if (await mobile.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)) throw new Error("Mobile has horizontal overflow.");

  const reduced = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await reduced.goto(`${origin}/demo/`, { waitUntil: "networkidle" });
  const animation = await reduced.locator(".preview-node").first().evaluate((element) => getComputedStyle(element).animationName);
  if (animation !== "none") throw new Error("Reduced-motion mode still animates preview nodes.");
  const companionAnimation = await reduced.locator(".companion-sprite--idle").evaluate((element) => getComputedStyle(element).animationName);
  if (companionAnimation !== "none") throw new Error("Reduced-motion mode still animates the companion.");
  console.log(JSON.stringify({ ok: true, desktopNodes: 5, mobileNodes: 4, companionSheets: spriteSizes.length, companionFramesPerState: 16, companionFps: 14, reducedMotion: true, noOverflow: true, faceSafe: true }, null, 2));
} finally {
  await browser.close();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
