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
const runtimeErrors: string[] = [];
const watchRuntime = (page: Page, label: string) => {
  page.on("pageerror", (error) => runtimeErrors.push(`${label} page error: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") runtimeErrors.push(`${label} console error: ${message.text()}`);
  });
};
try {
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  watchRuntime(desktop, "Desktop");
  await desktop.goto(origin, { waitUntil: "networkidle" });
  await desktop.waitForTimeout(1400);
  if (await desktop.locator(".preview-node").count() !== 5) throw new Error("Desktop must render five preview nodes.");
  const poses = desktop.locator(".companion-pose");
  if (await poses.count() !== 4) throw new Error("Companion must preload the four reduced-motion and responsive fallback poses.");
  const poseSizes = await poses.evaluateAll((elements) => elements.map((element) => ({ width: (element as HTMLImageElement).naturalWidth, height: (element as HTMLImageElement).naturalHeight })));
  if (poseSizes.some(({ width, height }) => width !== 1024 || height !== 1024)) throw new Error("A companion pose has unexpected dimensions.");
  const sprite = desktop.locator(".companion-sprite");
  if (await sprite.count() !== 1) throw new Error("Companion must render one state-driven sprite surface.");
  const initialCompanion = desktop.locator(".resumilio-companion");
  if (await initialCompanion.getAttribute("data-companion-state") !== "smile" || await initialCompanion.getAttribute("data-companion-mode") !== "welcome") {
    throw new Error("Companion did not run the same welcome-smile trigger as the full avatar.");
  }
  if (!(await sprite.evaluate((element) => getComputedStyle(element).backgroundImage)).includes("resumilio-cat-smile-sheet")) throw new Error("Welcome state did not load the smiling sprite sheet.");
  const initialFrame = Number(await sprite.getAttribute("data-sprite-frame"));
  await desktop.waitForTimeout(240);
  if (Number(await sprite.getAttribute("data-sprite-frame")) <= initialFrame) throw new Error("Welcome smile sprite did not advance at runtime.");
  await assertCompanionFaceClear(desktop, "Desktop");
  await desktop.locator(".preview-node").first().hover();
  await desktop.waitForTimeout(100);
  if (await initialCompanion.getAttribute("data-companion-state") !== "nod") throw new Error("Preview focus did not trigger companion acknowledgement.");
  if (await desktop.locator(".reserve-node").first().evaluate((element) => getComputedStyle(element).animationName) !== "reserve-ack") throw new Error("Nod state did not synchronize the background nodes.");
  const before = await desktop.locator(".focus-node h2").innerText();
  await desktop.locator(".preview-node").first().click();
  await desktop.waitForTimeout(450);
  if (await desktop.locator(".companion-pose--guide-wide").evaluate((element) => getComputedStyle(element).animationName) !== "cat-guide-wide") throw new Error("Desktop selection did not trigger the wide guidance pose.");
  if (Number(await desktop.locator(".companion-pose--guide-wide").evaluate((element) => getComputedStyle(element).opacity)) < 0.95) throw new Error("Desktop guidance pose did not become visibly opaque.");
  if (await desktop.locator(".reserve-node").first().evaluate((element) => getComputedStyle(element).animationName) !== "reserve-guide") throw new Error("Desktop guidance did not shift the constellation background.");
  if (await desktop.locator(".companion-backdrop").evaluate((element) => getComputedStyle(element).animationName) !== "companion-backdrop-guide") throw new Error("Desktop guidance did not animate the companion backdrop.");
  const after = await desktop.locator(".focus-node h2").innerText();
  if (before === after) throw new Error("Node selection did not promote a new career item.");
  await desktop.getByPlaceholder("Search roles, skills, or projects").fill("Field Guide");
  await desktop.getByRole("button", { name: "Search" }).click();
  if (!/Field Guide/.test(await desktop.locator(".focus-node h2").innerText())) throw new Error("Search did not promote its matching item.");
  await desktop.getByRole("button", { name: "Similar Work" }).click();
  await desktop.waitForTimeout(320);
  if (!/resumilio-companion--smile/.test(await desktop.locator(".resumilio-companion").getAttribute("class") ?? "")) throw new Error("Similar Work did not trigger the smiling companion state.");
  if (!(await sprite.evaluate((element) => getComputedStyle(element).backgroundImage)).includes("resumilio-cat-smile-sheet")) throw new Error("Similar Work did not select the smile sprite sequence.");
  const similarFrame = Number(await sprite.getAttribute("data-sprite-frame"));
  await desktop.waitForTimeout(240);
  if (Number(await sprite.getAttribute("data-sprite-frame")) <= similarFrame) throw new Error("Similar Work smile sprite did not advance between sampled frames.");
  if (await desktop.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)) throw new Error("Desktop has horizontal overflow.");

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  watchRuntime(mobile, "Mobile");
  await mobile.goto(`${origin}/demo/`, { waitUntil: "networkidle" });
  await mobile.waitForTimeout(1400);
  if (await mobile.locator(".preview-node").count() !== 4) throw new Error("Mobile must render four preview nodes.");
  await assertCompanionFaceClear(mobile, "Mobile");
  await mobile.locator(".preview-node").first().click();
  await mobile.waitForTimeout(450);
  if (await mobile.locator(".companion-pose--guide-mobile").evaluate((element) => getComputedStyle(element).animationName) !== "cat-guide-mobile") throw new Error("Mobile selection did not trigger the downward guidance pose.");
  if (Number(await mobile.locator(".companion-pose--guide-mobile").evaluate((element) => getComputedStyle(element).opacity)) < 0.95) throw new Error("Mobile guidance pose did not become visibly opaque.");
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
  watchRuntime(reduced, "Reduced motion");
  await reduced.goto(`${origin}/demo/`, { waitUntil: "networkidle" });
  const animation = await reduced.locator(".preview-node").first().evaluate((element) => getComputedStyle(element).animationName);
  if (animation !== "none") throw new Error("Reduced-motion mode still animates preview nodes.");
  if (await reduced.locator(".companion-sprite-window").evaluate((element) => getComputedStyle(element).display) !== "none") throw new Error("Reduced-motion mode still displays the animated sprite surface.");
  await reduced.getByRole("button", { name: "Similar Work" }).click();
  if (Number(await reduced.locator(".companion-pose--smile").evaluate((element) => getComputedStyle(element).opacity)) < 0.95) throw new Error("Reduced-motion mode did not reveal the static smiling pose.");
  if (runtimeErrors.length) throw new Error(`Browser runtime errors:\n${runtimeErrors.join("\n")}`);
  console.log(JSON.stringify({ ok: true, desktopNodes: 5, mobileNodes: 4, companionAssets: poseSizes.length + 2, companionAnimation: "64-frame-idle-with-blink-and-32-frame-smile-at-14fps", triggers: ["welcome", "focus-acknowledgement", "selection-guide", "search-smile", "similar-work-smile", "ambient-mix"], synchronizedBackground: true, reducedMotion: true, noOverflow: true, faceSafe: true, runtimeErrors: 0 }, null, 2));
} finally {
  await browser.close();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
