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
  { name: "wide-short", width: 2572, height: 1233 },
  { name: "four-k", width: 3840, height: 2160 },
];

function overlaps(first: { x: number; y: number; width: number; height: number }, second: { x: number; y: number; width: number; height: number }) {
  return first.x < second.x + second.width && first.x + first.width > second.x
    && first.y < second.y + second.height && first.y + first.height > second.y;
}

const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ["--no-sandbox"] });
const report = { viewports: [] as Array<Record<string, unknown>>, keyboard: false, reactiveNeighborhood: false, layerPreload: false, sharedNodeIdentity: false, previousCenterHandoff: false, incomingReserveMotion: false, outgoingRetreat: false, latestSelectionQueue: false, searchLayerTransition: false, similarWorkLayerTransition: false, mobileReserveCap: false, nodeTransition: false, nodeTransitionScreenshot: "", layerTransitionScreenshots: [] as string[], experienceLinkNewTab: false, avatarReactions: false, avatarPlayback: false, immediateIdlePlayback: false, ambientAvatarMix: false, avatarInteractionPriority: false, wideAvatarPlacement: false, responsiveAvatar: false, responsiveAvatarScreenshots: [] as string[], assistiveTechnologyStructureSmoke: false, reducedMotion: false, firstPartyRequests: 0, externalRequests: [] as string[], evidencePageScriptRequests: 0 };
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
    const visibleNodeCount = await page.locator(".claim-node:visible").count();
    if (["tablet", "desktop", "full-hd", "wide-short", "four-k"].includes(viewport.name) && visibleNodeCount !== 5) throw new Error(`${viewport.name} shows ${visibleNodeCount} active nodes; expected 5.`);
    const layerCount = Number(await page.locator(".graph-stage").getAttribute("data-layer-count"));
    const reserveCount = Number(await page.locator(".graph-stage").getAttribute("data-reserve-count"));
    const reserveDomCount = await page.locator(".reserve-layers .reserve-node").count();
    const visibleReserveCount = await page.locator(".reserve-layers .reserve-node:visible").count();
    if (visibleNodeCount === 5 && layerCount !== 5) throw new Error(`${viewport.name} preloaded ${layerCount} layers; expected one for every active node.`);
    if (reserveDomCount !== reserveCount) throw new Error(`${viewport.name} reserve DOM count does not match its data plan.`);
    if (viewport.name === "desktop") {
      const owners = await page.locator(".reserve-layers .reserve-node").evaluateAll((nodes) => new Set(nodes.map((node) => node.getAttribute("data-reserve-owner"))).size);
      const reserveLayerIsHidden = await page.locator(".reserve-layers").getAttribute("aria-hidden") === "true";
      const focusableReserves = await page.locator('.reserve-layers button, .reserve-layers a, .reserve-layers input, .reserve-layers [tabindex]').count();
      report.layerPreload = layerCount === 5 && reserveCount > 0 && owners === 5 && reserveLayerIsHidden && focusableReserves === 0;
    }
    if (["watch", "small-mobile", "mobile"].includes(viewport.name) && visibleReserveCount > 8) throw new Error(`${viewport.name} exposes ${visibleReserveCount} reserve ghosts; expected at most 8.`);
    if (viewport.name === "mobile") report.mobileReserveCap = visibleReserveCount <= 8;
    let responsiveAvatarSizing: Record<string, unknown> | undefined;
    if (viewport.name === "wide-short") {
      const avatarBox = await page.locator(".avatar-guide").boundingBox();
      const backdropBox = await page.locator(".avatar-node-backdrop").boundingBox();
      const focusBox = await page.locator(".experience-focus").boundingBox();
      const nodeBoxes = await page.locator(".claim-node").evaluateAll((nodes) => nodes.map((node) => {
        const box = node.getBoundingClientRect();
        return { x: box.x, y: box.y, width: box.width, height: box.height };
      }));
      if (!avatarBox || !backdropBox || !focusBox || avatarBox.width < 430) throw new Error("Wide-short layout did not expand the avatar into available space.");
      if (overlaps(backdropBox, focusBox) || nodeBoxes.some((nodeBox) => overlaps(backdropBox, nodeBox))) throw new Error("Responsive avatar growth intrudes into featured or active experience nodes.");
      responsiveAvatarSizing = { avatarWidth: avatarBox.width, backdropWidth: backdropBox.width, collisionFree: true };
    }
    const screenshot = join(outputDirectory, `${viewport.width}x${viewport.height}-${viewport.name}.png`);
    await page.screenshot({ path: screenshot, fullPage: true });
    const external = requests.filter((url) => new URL(url).origin !== origin);
    report.externalRequests.push(...external);
    report.firstPartyRequests += requests.length - external.length;
    report.viewports.push({ ...viewport, overflow, visibleTargets, visibleNodeCount, layerCount, reserveCount, visibleReserveCount, responsiveAvatarSizing, screenshot });

    if (viewport.name === "mobile") {
      const initialNodes = page.locator(".claim-node");
      const initialCount = await initialNodes.count();
      if (initialCount < 1 || initialCount > 5) throw new Error(`Reactive neighborhood rendered ${initialCount} nodes; expected 1-5.`);
      const initialIds = await initialNodes.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-claim-id")));
      const initialFeature = await page.locator(".experience-focus").getAttribute("data-selected-id");
      const firstClaim = initialNodes.first();
      await firstClaim.focus();
      const before = await firstClaim.getAttribute("data-claim-id");
      await page.keyboard.press("ArrowDown");
      const active = page.locator(".claim-node:focus");
      const after = await active.getAttribute("data-claim-id");
      const outlineStyle = await active.evaluate((element) => getComputedStyle(element).outlineStyle);
      if (!before || !after || before === after || outlineStyle === "none") throw new Error("Directional-key focus or visible focus failed.");
      report.keyboard = true;
      await active.click();
      const nextFeature = await page.locator(".experience-focus").getAttribute("data-selected-id");
      const nextIds = await page.locator(".claim-node").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-claim-id")));
      if (!initialFeature || !nextFeature || initialFeature === nextFeature || initialIds.join("|") === nextIds.join("|")) throw new Error("Selected experience or constellation neighborhood did not change after selecting a node.");
      report.reactiveNeighborhood = true;
      await page.locator(".search-field input").fill("HubSpot");
      await page.locator(".search-controls").press("Enter");
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

  const linkContext = await browser.newContext({ viewport: { width: 1440, height: 1024 }, reducedMotion: "reduce" });
  const constellationPage = await linkContext.newPage();
  await constellationPage.goto(`${origin}/`, { waitUntil: "networkidle" });
  const sourceUrl = constellationPage.url();
  const detailPagePromise = linkContext.waitForEvent("page");
  await constellationPage.locator(".experience-focus .button--primary").click();
  const detailPage = await detailPagePromise;
  await detailPage.waitForLoadState("networkidle");
  if (constellationPage.url() !== sourceUrl || !detailPage.url().includes("/evidence/claim-")) throw new Error("View experience did not preserve the constellation and open the record in a new tab.");
  report.experienceLinkNewTab = true;
  await linkContext.close();

  const motionContext = await browser.newContext({ viewport: { width: 1440, height: 1024 }, reducedMotion: "no-preference" });
  const motionPage = await motionContext.newPage();
  await motionPage.goto(`${origin}/`, { waitUntil: "networkidle" });
  const video = motionPage.locator(".avatar-video");
  await motionPage.waitForFunction(() => {
    const element = document.querySelector<HTMLVideoElement>(".avatar-video");
    return Boolean(element && !element.paused && element.currentTime > 0.1 && element.currentSrc.endsWith("daniel-idle.mp4"));
  });
  const playbackConfiguration = await video.evaluate((element) => {
    const media = element as HTMLVideoElement;
    return {
      autoPlay: media.autoplay,
      loop: media.loop,
      muted: media.muted,
      playsInline: media.playsInline,
      preload: media.preload,
    };
  });
  if (!playbackConfiguration.autoPlay || playbackConfiguration.loop || !playbackConfiguration.muted || !playbackConfiguration.playsInline || playbackConfiguration.preload !== "auto") {
    throw new Error("Ambient avatar playback configuration does not support natural clip handoffs.");
  }
  report.immediateIdlePlayback = true;
  const avatar = motionPage.locator(".avatar-guide");
  await motionPage.evaluate(() => {
    const values = [0.1, 0.7, 0.9];
    let index = 0;
    Math.random = () => values[index++] ?? 0.1;
  });
  for (const expected of ["idle", "waiting", "smile"]) {
    const previousSequence = Number(await avatar.getAttribute("data-avatar-sequence"));
    await video.evaluate((element) => element.dispatchEvent(new Event("ended", { bubbles: true })));
    await motionPage.waitForFunction(({ reaction, sequence }) => {
      const element = document.querySelector(".avatar-guide");
      return element?.getAttribute("data-avatar-state") === reaction
        && element.getAttribute("data-avatar-mode") === "ambient"
        && Number(element.getAttribute("data-avatar-sequence")) > sequence;
    }, { reaction: expected, sequence: previousSequence });
  }
  report.ambientAvatarMix = true;
  const graphBox = await motionPage.locator(".graph-stage").boundingBox();
  const avatarBox = await avatar.boundingBox();
  report.wideAvatarPlacement = Boolean(graphBox && avatarBox
    && avatarBox.x < graphBox.x + graphBox.width * .2
    && avatarBox.y > graphBox.y + graphBox.height * .35);
  if (!report.wideAvatarPlacement) throw new Error("Wide avatar is not anchored in the lower-left supporting position.");
  const previousCenterId = await motionPage.locator(".experience-focus").getAttribute("data-selected-id");
  const transitionTarget = await motionPage.locator(".claim-node").first().getAttribute("data-claim-id");
  await motionPage.locator(".claim-node").first().hover();
  await motionPage.waitForFunction(() => document.querySelector(".avatar-guide")?.getAttribute("data-avatar-state") === "nod"
    && document.querySelector(".avatar-guide")?.getAttribute("data-avatar-mode") === "interactive");
  await motionPage.locator(".claim-node").first().click();
  await motionPage.waitForFunction((claimId) => document.querySelector(".graph-stage")?.getAttribute("data-transition-phase") === "out"
    && document.querySelector('[data-node-role="selected-target"]')?.getAttribute("data-claim-id") === claimId, transitionTarget);
  const sharedNode = motionPage.locator('[data-node-role="shared"]').first();
  const sharedNodeId = await sharedNode.getAttribute("data-claim-id");
  const sharedNodeHandle = await sharedNode.elementHandle();
  const advancingReserve = motionPage.locator(".transition-reserves .reserve-node--advancing").first();
  const reserveMotion = await advancingReserve.evaluate((node) => {
    const style = getComputedStyle(node);
    return {
      animationName: style.animationName,
      fromX: style.getPropertyValue("--from-x"),
      fromY: style.getPropertyValue("--from-y"),
      toX: style.getPropertyValue("--to-x"),
      toY: style.getPropertyValue("--to-y"),
    };
  });
  report.incomingReserveMotion = reserveMotion.animationName === "reserve-advance"
    && `${reserveMotion.fromX}|${reserveMotion.fromY}` !== `${reserveMotion.toX}|${reserveMotion.toY}`;
  if (!report.incomingReserveMotion) throw new Error("The chosen reserve layer did not animate from its preloaded coordinates.");
  const nodeTransitionScreenshot = join(outputDirectory, "node-transition-out.png");
  await motionPage.screenshot({ path: nodeTransitionScreenshot });
  report.nodeTransitionScreenshot = nodeTransitionScreenshot;
  report.layerTransitionScreenshots.push(nodeTransitionScreenshot);
  await motionPage.waitForFunction((claimId) => document.querySelector(".experience-focus")?.getAttribute("data-selected-id") === claimId, transitionTarget);
  const previousCenter = motionPage.locator('[data-node-role="previous-center"]');
  report.previousCenterHandoff = await previousCenter.getAttribute("data-claim-id") === previousCenterId
    && await previousCenter.evaluate((node) => getComputedStyle(node).animationName) === "previous-center-out";
  if (!report.previousCenterHandoff) throw new Error("The previous center did not move outward into the selected node's vacated slot.");
  if (!sharedNodeId || !sharedNodeHandle) throw new Error("The transition did not expose a shared node for identity verification.");
  report.sharedNodeIdentity = await motionPage.locator(`.claim-node[data-claim-id="${sharedNodeId}"]`).evaluate((node, previous) => node === previous, sharedNodeHandle);
  if (!report.sharedNodeIdentity) throw new Error("A shared active node was remounted instead of remaining spatially continuous.");
  const layerArrivalScreenshot = join(outputDirectory, "node-transition-in.png");
  await motionPage.screenshot({ path: layerArrivalScreenshot });
  report.layerTransitionScreenshots.push(layerArrivalScreenshot);
  await motionPage.waitForFunction(() => document.querySelector(".graph-stage")?.getAttribute("data-transition-phase") === "idle");
  const layerSettledScreenshot = join(outputDirectory, "node-transition-settled.png");
  await motionPage.screenshot({ path: layerSettledScreenshot });
  report.layerTransitionScreenshots.push(layerSettledScreenshot);
  report.nodeTransition = true;
  if (await avatar.getAttribute("data-avatar-state") !== "guide"
    || await avatar.getAttribute("data-avatar-variant") !== "wide"
    || !String(await video.getAttribute("src")).endsWith("daniel-guide-wide.mp4")) throw new Error("Wide selection did not use the pointing guidance clip.");
  report.avatarReactions = true;
  await motionPage.waitForFunction(() => (document.querySelector<HTMLVideoElement>(".avatar-video")?.currentTime ?? 0) > 2);
  const wideGuideScreenshot = join(outputDirectory, "responsive-guide-wide.png");
  await motionPage.screenshot({ path: wideGuideScreenshot });
  report.responsiveAvatarScreenshots.push(wideGuideScreenshot);
  const guideSequence = Number(await avatar.getAttribute("data-avatar-sequence"));
  await video.evaluate((element) => element.dispatchEvent(new Event("ended", { bubbles: true })));
  await motionPage.waitForFunction((sequence) => {
    const element = document.querySelector(".avatar-guide");
    return element?.getAttribute("data-avatar-state") === "idle"
      && element.getAttribute("data-avatar-mode") === "ambient"
      && Number(element.getAttribute("data-avatar-sequence")) > sequence;
  }, guideSequence);
  report.avatarInteractionPriority = true;

  await motionPage.setViewportSize({ width: 390, height: 844 });
  await motionPage.waitForFunction(() => matchMedia("(max-width: 700px)").matches && document.querySelector(".avatar-guide")?.getAttribute("data-avatar-layout") === "stacked");
  const selectedNodeId = await motionPage.locator(".claim-node").nth(1).getAttribute("data-claim-id");
  const selectedNodeTitle = (await motionPage.locator(".claim-node strong").nth(1).textContent())?.trim();
  await motionPage.locator(".claim-node").nth(1).click();
  await motionPage.waitForFunction((claimId) => document.querySelector(".experience-focus")?.getAttribute("data-selected-id") === claimId, selectedNodeId);
  const calloutTitle = (await motionPage.locator(".avatar-mobile-callout strong").textContent())?.trim();
  if (await avatar.getAttribute("data-avatar-state") !== "guide"
    || await avatar.getAttribute("data-avatar-variant") !== "stacked"
    || !String(await video.getAttribute("src")).endsWith("daniel-guide-stacked.mp4")
    || !await motionPage.locator(".avatar-mobile-callout").isVisible()
    || !selectedNodeTitle
    || calloutTitle !== selectedNodeTitle) throw new Error("Stacked selection did not use the downward guidance clip and synchronized mobile callout.");
  await avatar.scrollIntoViewIfNeeded();
  const stackedGuideScreenshot = join(outputDirectory, "responsive-guide-stacked.png");
  await motionPage.screenshot({ path: stackedGuideScreenshot });
  report.responsiveAvatarScreenshots.push(stackedGuideScreenshot);
  report.responsiveAvatar = true;

  await motionPage.setViewportSize({ width: 1440, height: 1024 });
  await motionPage.waitForFunction(() => !matchMedia("(max-width: 700px)").matches && document.querySelector(".avatar-guide")?.getAttribute("data-avatar-layout") === "wide");
  await motionPage.locator(".experience-focus .button--secondary").click();
  if (await avatar.getAttribute("data-avatar-state") !== "smile"
    || await avatar.getAttribute("data-avatar-mode") !== "interactive"
    || !String(await video.getAttribute("src")).endsWith("daniel-smile.mp4")) throw new Error("Smile playback did not replace guidance after recommendation.");
  const smileSequence = Number(await avatar.getAttribute("data-avatar-sequence"));
  await video.evaluate((element) => element.dispatchEvent(new Event("ended", { bubbles: true })));
  await motionPage.waitForFunction((sequence) => {
    const element = document.querySelector(".avatar-guide");
    return element?.getAttribute("data-avatar-mode") === "ambient"
      && Number(element.getAttribute("data-avatar-sequence")) > sequence;
  }, smileSequence);
  report.avatarPlayback = true;
  await motionContext.close();

  const outgoingContext = await browser.newContext({ viewport: { width: 1440, height: 1024 }, reducedMotion: "no-preference" });
  const outgoingPage = await outgoingContext.newPage();
  await outgoingPage.goto(`${origin}/`, { waitUntil: "networkidle" });
  await outgoingPage.locator('[data-claim-id="claim-on-the-fuze-backend-lead"].claim-node').click();
  await outgoingPage.waitForFunction(() => document.querySelector(".graph-stage")?.getAttribute("data-transition-phase") === "idle"
    && document.querySelector(".experience-focus")?.getAttribute("data-selected-id") === "claim-on-the-fuze-backend-lead");
  await outgoingPage.locator('[data-claim-id="claim-alphahub-hubspot-specialist"].claim-node').click();
  await outgoingPage.waitForFunction(() => document.querySelector(".graph-stage")?.getAttribute("data-transition-phase") === "out");
  const outgoingNodes = outgoingPage.locator('[data-node-role="outgoing"]');
  report.outgoingRetreat = await outgoingNodes.count() > 0
    && await outgoingNodes.first().evaluate((node) => getComputedStyle(node).animationName) === "node-depart";
  if (!report.outgoingRetreat) throw new Error("A low-overlap branch did not send obsolete nodes into the background.");
  await outgoingContext.close();

  const queueContext = await browser.newContext({ viewport: { width: 1440, height: 1024 }, reducedMotion: "no-preference" });
  const queuePage = await queueContext.newPage();
  await queuePage.goto(`${origin}/`, { waitUntil: "networkidle" });
  const firstQueuedTarget = await queuePage.locator(".claim-node").nth(0).getAttribute("data-claim-id");
  const latestQueuedTarget = await queuePage.locator(".claim-node").nth(1).getAttribute("data-claim-id");
  await queuePage.locator(".claim-node").nth(0).click();
  await queuePage.waitForFunction(() => document.querySelector(".graph-stage")?.getAttribute("data-transition-phase") === "out");
  await queuePage.locator(".claim-node").nth(1).click();
  await queuePage.waitForFunction((claimId) => document.querySelector(".graph-stage")?.getAttribute("data-queued-claim") === claimId, latestQueuedTarget);
  await queuePage.waitForFunction((claimId) => document.querySelector(".experience-focus")?.getAttribute("data-selected-id") === claimId
    && document.querySelector(".graph-stage")?.getAttribute("data-transition-phase") === "idle", latestQueuedTarget, { timeout: 3000 });
  report.latestSelectionQueue = Boolean(firstQueuedTarget && latestQueuedTarget && firstQueuedTarget !== latestQueuedTarget);
  await queueContext.close();

  const mobileDepthContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const mobileDepthPage = await mobileDepthContext.newPage();
  await mobileDepthPage.goto(`${origin}/`, { waitUntil: "networkidle" });
  await mobileDepthPage.locator('[data-claim-id="claim-on-the-fuze-backend-lead"].claim-node').click();
  await mobileDepthPage.waitForFunction(() => document.querySelector(".experience-focus")?.getAttribute("data-selected-id") === "claim-on-the-fuze-backend-lead");
  const mobileReserveCount = Number(await mobileDepthPage.locator(".graph-stage").getAttribute("data-reserve-count"));
  const mobileVisibleReserves = await mobileDepthPage.locator(".reserve-layers .reserve-node:visible").count();
  report.mobileReserveCap = mobileReserveCount > 8 && mobileVisibleReserves === 8;
  if (!report.mobileReserveCap) throw new Error(`Mobile reserve stress state exposed ${mobileVisibleReserves} of ${mobileReserveCount} ghosts; expected exactly 8 visible.`);
  await mobileDepthContext.close();

  const searchContext = await browser.newContext({ viewport: { width: 1440, height: 1024 }, reducedMotion: "no-preference" });
  const searchPage = await searchContext.newPage();
  await searchPage.goto(`${origin}/`, { waitUntil: "networkidle" });
  await searchPage.waitForFunction(() => Boolean(sessionStorage.getItem("resumilio:discovery:v1")));
  const signalCountBeforeTyping = await searchPage.evaluate(() => JSON.parse(sessionStorage.getItem("resumilio:discovery:v1") ?? "{}").signalCount ?? 0);
  await searchPage.locator(".search-field input").fill("Backend Technical Lead");
  const searchTarget = await searchPage.locator(".claim-node").first().getAttribute("data-claim-id");
  const signalCountAfterTyping = await searchPage.evaluate(() => JSON.parse(sessionStorage.getItem("resumilio:discovery:v1") ?? "{}").signalCount ?? 0);
  const visibleSearchNodes = await searchPage.locator(".claim-node").count();
  const searchLayerCount = Number(await searchPage.locator(".graph-stage").getAttribute("data-layer-count"));
  if (signalCountBeforeTyping !== signalCountAfterTyping || visibleSearchNodes !== searchLayerCount) throw new Error("Typing a search changed discovery state or failed to preload its visible result layers.");
  await searchPage.locator(".search-controls").press("Enter");
  await searchPage.waitForFunction((claimId) => document.querySelector(".graph-stage")?.getAttribute("data-transition-phase") === "out"
    && document.querySelector(".graph-stage")?.getAttribute("data-transition-target") === claimId, searchTarget);
  report.searchLayerTransition = true;
  await searchContext.close();

  const similarContext = await browser.newContext({ viewport: { width: 1440, height: 1024 }, reducedMotion: "no-preference" });
  const similarPage = await similarContext.newPage();
  await similarPage.goto(`${origin}/`, { waitUntil: "networkidle" });
  await similarPage.locator(".experience-focus .button--secondary").click();
  await similarPage.waitForFunction(() => document.querySelector(".graph-stage")?.getAttribute("data-transition-phase") === "out"
    && Boolean(document.querySelector(".graph-stage")?.getAttribute("data-transition-target")));
  report.similarWorkLayerTransition = true;
  await similarContext.close();

  if (report.externalRequests.length > 0) throw new Error(`External runtime requests detected: ${report.externalRequests.join(", ")}`);
  if (!report.keyboard || !report.reactiveNeighborhood || !report.layerPreload || !report.sharedNodeIdentity || !report.previousCenterHandoff || !report.incomingReserveMotion || !report.outgoingRetreat || !report.latestSelectionQueue || !report.searchLayerTransition || !report.similarWorkLayerTransition || !report.mobileReserveCap || !report.nodeTransition || !report.experienceLinkNewTab || !report.avatarReactions || !report.avatarPlayback || !report.immediateIdlePlayback || !report.ambientAvatarMix || !report.avatarInteractionPriority || !report.wideAvatarPlacement || !report.responsiveAvatar || !report.assistiveTechnologyStructureSmoke || !report.reducedMotion) throw new Error("One or more interaction or accessibility structure smoke checks failed.");
  if (report.evidencePageScriptRequests > 0) throw new Error("Static evidence pages loaded JavaScript.");
  writeFileSync(join(outputDirectory, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
