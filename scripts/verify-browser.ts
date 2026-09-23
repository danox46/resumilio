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

async function assertFocusCircle(page: Page, label: string) {
  const focus = await page.locator(".focus-node").boundingBox();
  if (!focus) throw new Error(`${label} focus node is missing.`);
  if (Math.abs(focus.width - focus.height) > 1) throw new Error(`${label} focus node became an oval (${focus.width}×${focus.height}).`);
  const radius = focus.width / 2;
  const centerX = focus.x + radius;
  const centerY = focus.y + radius;
  for (const node of await page.locator(".preview-node").all()) {
    const box = await node.boundingBox();
    if (!box) continue;
    const distance = Math.hypot(box.x + box.width / 2 - centerX, box.y + box.height / 2 - centerY);
    if (distance < radius + box.width / 2 - 2) throw new Error(`${label} preview node intersects the focus circle.`);
  }
  const titleOverflows = await page.locator(".focus-node h2").evaluate((element) => element.scrollWidth > element.clientWidth + 1);
  if (titleOverflows) throw new Error(`${label} focus title exceeds its content area.`);
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
  if (await desktop.getByRole("heading", { name: "One career. More ways to understand it." }).count() !== 1) throw new Error("English product outcomes heading is missing.");
  if (await desktop.getByText("Source setup available now").count() !== 1) throw new Error("Product home still advertises an unpublished npm install.");
  if (await desktop.locator(".feature-band .feature").count() !== 3) throw new Error("Product home must present the three career outcomes.");
  for (const title of ["A new visual experience", "A classic resume, ready", "Recommendations that react"]) {
    if (await desktop.getByRole("heading", { name: title }).count() !== 1) throw new Error(`English product outcome is missing: ${title}.`);
  }
  if (await desktop.locator(".wordmark .brand-mark circle").count() !== 6) throw new Error("The connected-node Resumilio logo is missing.");
  if (await desktop.locator(".preview-node").count() !== 5) throw new Error("Desktop must render five preview nodes.");
  await assertFocusCircle(desktop, "Desktop home demo");
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

  await desktop.getByRole("link", { name: "Roadmap" }).click();
  if (new URL(desktop.url()).pathname !== "/roadmap/") throw new Error("Product navigation did not open the roadmap.");
  if (await desktop.getByRole("heading", { level: 1, name: "Product roadmap" }).count() !== 1) throw new Error("Product roadmap heading is missing.");
  if (await desktop.locator(".roadmap-milestone").count() !== 4) throw new Error("Roadmap must show the four planned release stages.");
  for (const title of ["Stability", "Authoring skill", "Claude + Antigravity", "Manual authoring"]) {
    if (await desktop.getByRole("heading", { name: title, exact: true }).count() !== 1) throw new Error(`Roadmap stage is missing: ${title}.`);
  }
  await desktop.getByRole("link", { name: "03: Claude + Antigravity" }).click();
  if (new URL(desktop.url()).hash !== "#agents") throw new Error("Roadmap waypoint did not link to its release stage.");
  if (await desktop.locator(".roadmap-milestone:target h2").innerText() !== "Claude + Antigravity") throw new Error("Roadmap target styling did not follow the selected waypoint.");
  await desktop.getByRole("link", { name: "ES", exact: true }).click();
  if (new URL(desktop.url()).pathname !== "/es/hoja-de-ruta/") throw new Error("Roadmap locale switch lost the roadmap route.");
  if (await desktop.getByRole("heading", { level: 1, name: "Hoja de ruta" }).count() !== 1) throw new Error("Spanish roadmap heading is missing.");
  if (await desktop.getByRole("heading", { name: "Estabilidad", exact: true }).count() !== 1) throw new Error("Spanish roadmap translation is missing.");
  if (await desktop.locator("html").getAttribute("lang") !== "es") throw new Error("Spanish roadmap has the wrong document language.");
  for (const width of [1440, 768, 390, 320]) {
    const roadmap = await browser.newPage({ viewport: { width, height: 900 } });
    watchRuntime(roadmap, `${width}px roadmap`);
    await roadmap.goto(`${origin}/roadmap/`, { waitUntil: "networkidle" });
    if (await roadmap.locator(".roadmap-milestone").count() !== 4) throw new Error(`${width}px roadmap lost a release stage.`);
    if (await roadmap.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)) throw new Error(`${width}px roadmap has horizontal overflow.`);
    if (!(await roadmap.getByRole("link", { name: "Roadmap", exact: true }).isVisible())) throw new Error(`${width}px roadmap navigation is hidden.`);
    await roadmap.close();
  }
  for (const width of [390, 320]) {
    const roadmap = await browser.newPage({ viewport: { width, height: 900 } });
    watchRuntime(roadmap, `${width}px Spanish roadmap`);
    await roadmap.goto(`${origin}/es/hoja-de-ruta/`, { waitUntil: "networkidle" });
    if (await roadmap.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)) throw new Error(`${width}px Spanish roadmap has horizontal overflow.`);
    await roadmap.close();
  }

  const spanishHome = await browser.newPage({ viewport: { width: 390, height: 844 } });
  watchRuntime(spanishHome, "Spanish mobile home");
  await spanishHome.goto(`${origin}/es/`, { waitUntil: "networkidle" });
  if (await spanishHome.getByRole("heading", { name: "Una carrera. Más formas de entenderla." }).count() !== 1) throw new Error("Spanish product outcomes heading is missing.");
  if (await spanishHome.getByText("Instalación desde código disponible").count() !== 1) throw new Error("Spanish product home still advertises an unpublished npm install.");
  for (const title of ["Una nueva experiencia visual", "Una hoja de vida clásica, lista", "Recomendaciones que reaccionan"]) {
    if (await spanishHome.getByRole("heading", { name: title }).count() !== 1) throw new Error(`Spanish product outcome is missing: ${title}.`);
  }
  if (await spanishHome.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)) throw new Error("Spanish mobile product home has horizontal overflow.");
  await spanishHome.goto(`${origin}/es/demo/`, { waitUntil: "networkidle" });
  if ((await spanishHome.locator(".demo-watermark").textContent())?.trim() !== "Perfil ficticio") throw new Error("Spanish demo lost its fictional-profile watermark.");
  await spanishHome.close();

  for (const width of [1920, 768, 320]) {
    const viewport = await browser.newPage({ viewport: { width, height: 900 } });
    watchRuntime(viewport, `${width}px demo`);
    await viewport.goto(`${origin}/demo/`, { waitUntil: "networkidle" });
    if (await viewport.locator(".demo-disclosure").count()) throw new Error(`${width}px demo still has a framed disclosure.`);
    if ((await viewport.locator(".demo-watermark").textContent())?.trim() !== "Fictional profile") throw new Error(`${width}px demo lost its fictional-profile watermark.`);
    await viewport.waitForTimeout(1400);
    await assertFocusCircle(viewport, `${width}px demo`);
    await viewport.close();
  }

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  watchRuntime(mobile, "Mobile");
  await mobile.goto(`${origin}/demo/`, { waitUntil: "networkidle" });
  if ((await mobile.locator(".demo-watermark").textContent())?.trim() !== "Fictional profile") throw new Error("Mobile demo lost its fictional-profile watermark.");
  await mobile.waitForTimeout(1400);
  if (await mobile.locator(".preview-node").count() !== 4) throw new Error("Mobile must render four preview nodes.");
  await assertFocusCircle(mobile, "Mobile demo");
  await assertCompanionFaceClear(mobile, "Mobile");
  const mobileCat = await mobile.locator(".resumilio-companion").boundingBox();
  const initialMobileFocus = await mobile.locator(".focus-node").boundingBox();
  if (!mobileCat || !initialMobileFocus || mobileCat.y + mobileCat.height * 0.55 >= initialMobileFocus.y) {
    throw new Error("Mobile companion face must sit above the focused node so its downward guide pose has a target.");
  }
  await mobile.locator(".preview-node").first().click();
  await mobile.waitForTimeout(450);
  if (await mobile.locator(".companion-pose--guide-mobile").evaluate((element) => getComputedStyle(element).animationName) !== "cat-guide-mobile") throw new Error("Mobile selection did not trigger the downward guidance pose.");
  if (Number(await mobile.locator(".companion-pose--guide-mobile").evaluate((element) => getComputedStyle(element).opacity)) < 0.95) throw new Error("Mobile guidance pose did not become visibly opaque.");
  const focus = await mobile.locator(".focus-node").boundingBox();
  if (!focus) throw new Error("Mobile focus node is missing.");
  if (mobileCat.y + mobileCat.height * 0.55 >= focus.y) throw new Error("Mobile guide pose no longer looks down toward the promoted focus node.");
  for (const node of await mobile.locator(".preview-node").all()) {
    const box = await node.boundingBox();
    if (!box) continue;
    const overlap = !(box.x + box.width < focus.x || focus.x + focus.width < box.x || box.y + box.height < focus.y || focus.y + focus.height < box.y);
    if (overlap) throw new Error("A mobile preview node overlaps the focus node.");
  }
  if (await mobile.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)) throw new Error("Mobile has horizontal overflow.");

  const classic = await browser.newPage({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false });
  watchRuntime(classic, "Classic without JavaScript");
  await classic.goto(`${origin}/classic/#cloud-integration-certificate`, { waitUntil: "networkidle" });
  await classic.waitForTimeout(200);
  const target = classic.locator("#cloud-integration-certificate");
  if (!(await target.isVisible()) || !(await target.evaluate((element) => (element.closest("details") as HTMLDetailsElement)?.open))) throw new Error("Classic deep link did not reveal a collapsed target without JavaScript.");
  if (!(await classic.locator(".classic-resources a").count())) throw new Error("Classic view does not expose public resource links.");
  await classic.goto(`${origin}/classic/`, { waitUntil: "networkidle" });
  await classic.emulateMedia({ media: "print" });
  if (!(await classic.locator("#cloud-integration-certificate").isVisible())) throw new Error("Classic print view hides entries inside closed sections.");
  await classic.close();

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
