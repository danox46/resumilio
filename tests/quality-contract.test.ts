import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import test from "node:test";

const component = readFileSync("src/components/EvidenceExplorer.tsx", "utf8");
const avatarSchedule = readFileSync("src/avatar-schedule.ts", "utf8");
const styles = readFileSync("src/styles/global.css", "utf8");
const siteSource = readFileSync("src/site.ts", "utf8");
const entryPages = readFileSync("src/pages/index.astro", "utf8") + readFileSync("src/pages/es/index.astro", "utf8");

test("claim controls expose directional keyboard navigation", () => {
  for (const key of ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"]) {
    assert.match(component, new RegExp(`\\\"${key}\\\"`));
  }
  assert.match(component, /onKeyDown=\{\(event\) => moveClaimFocus\(event, claim\)\}/);
  assert.match(component, /visibleNeighborhoodSize = 5/);
  assert.match(component, /slice\(0, visibleNeighborhoodSize\)/);
  assert.doesNotMatch(component, /evidence-table|allTypes|allStatuses|allSkills/);
  assert.match(component, /data-transition-phase=\{transition\.phase\}/);
  assert.match(component, /data-node-role=\{role\}/);
  assert.match(component, /data-layer-count=\{layerPlan\.successors\.length\}/);
  assert.match(component, /data-reserve-count=\{layerPlan\.reserveCount\}/);
  assert.match(component, /className="reserve-layers" aria-hidden="true"/);
  assert.match(component, /className="transition-reserves" aria-hidden="true"/);
  assert.match(component, /setQueuedSelection\(intent\)/);
  assert.match(component, /className="ambient-nodes" aria-hidden="true"/);
  assert.match(component, /href=\{claimPath\(claim\.id, locale\)\} target="_blank" rel="noopener noreferrer"/);
  assert.match(entryPages, /client:load/);
});

test("visual motion and focus have accessible alternatives", () => {
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
  assert.match(styles, /\.avatar-video \{ display: none; \}/);
  assert.match(component, /aria-describedby="graph-help"/);
  assert.match(component, /className="sr-only" id="graph-help"/);
});

test("the constellation preloads semantic reserve layers without changing public copy", () => {
  assert.match(component, /transitionCommitMs = 320/);
  assert.match(component, /transitionSettleMs = 700/);
  assert.match(component, /backgroundReserves = layerPlan\.successors\.flatMap/);
  assert.match(component, /data-reserve-owner=\{node\.ownerId\}/);
  assert.match(component, /data-node-role=\{role\}/);
  assert.match(styles, /@keyframes reserve-advance/);
  assert.match(styles, /@keyframes previous-center-out/);
  assert.match(styles, /\.reserve-layers \.reserve-node:nth-child\(n \+ 9\) \{ display: none; \}/);
  assert.equal(component.match(/size: (144|210|310), tone:/g)?.length, 3);
});

test("the avatar uses bounded local media for shared and responsive reactions", () => {
  for (const name of ["daniel-idle.mp4", "daniel-waiting.mp4", "daniel-nod.mp4", "daniel-smile.mp4", "daniel-guide-wide.mp4", "daniel-guide-stacked.mp4", "daniel-idle-poster.webp"]) {
    const path = `public/media/avatar/${name}`;
    assert.ok(existsSync(path), `${path} is missing`);
    assert.ok(statSync(path).size > 0, `${path} is empty`);
  }
  assert.match(component, /data-avatar-state=\{reaction\}/);
  assert.match(component, /data-avatar-mode=\{mode\}/);
  assert.match(component, /onFocus=\{acknowledgeNode\}/);
  assert.match(component, /onMouseEnter=\{acknowledgeNode\}/);
  assert.match(component, /current\.mode === "ambient" \? \{ reaction: "nod"/);
  assert.match(component, /const selectClaim = \(claim: Claim, reaction: "guide" \| "smile" = "guide"\)/);
  assert.match(component, /showReaction\(intent\.reaction\)/);
  assert.match(component, /stackedAvatarQuery = "\(max-width: 700px\)"/);
  assert.match(component, /media\.addEventListener\("change", syncLayout\)/);
  assert.match(component, /data-avatar-variant=\{reaction === "guide" \? layout : "shared"\}/);
  assert.match(styles, /\.experience-shell \.avatar-mobile-callout \{\s*position: absolute;/);
  assert.match(styles, /\.experience-shell \.avatar-guide \{\s*left: clamp\(105px, 13vw, 220px\);\s*bottom: -7%;/);
  assert.match(styles, /@media \(min-width: 1800px\)[\s\S]*?width: clamp\(300px, min\(18vw, 38svh, calc\(30vw - 300px\)\), 470px\)/);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*?\.experience-shell \.avatar-guide \{\s*position: absolute;\s*left: 50%;\s*top: 4px;/);
  assert.match(styles, /\.avatar-media \{[\s\S]*?-webkit-mask-image:[\s\S]*?linear-gradient[\s\S]*?radial-gradient/);
  assert.match(styles, /\.avatar-node-backdrop \{[\s\S]*?border-radius: 50%;/);
  assert.match(component, /x1=\{constellationFocus\[0\]\} y1=\{constellationFocus\[1\]\}/);
  assert.match(component, /showReaction\("smile"\)/);
  assert.match(avatarSchedule, /reaction: "idle", weight: 0\.6/);
  assert.match(avatarSchedule, /reaction: "waiting", weight: 0\.2/);
  assert.match(avatarSchedule, /reaction: "smile", weight: 0\.2/);
  assert.match(component, /onEnded=\{onComplete\}/);
  assert.doesNotMatch(component, /waitingReactionDelayMs|loop=|showReaction\("waiting"\)/);
  assert.match(component, /autoPlay/);
  assert.match(component, /preload="auto"/);
  assert.doesNotMatch(component, /beginMotion|mediaReady/);
  assert.equal(entryPages.match(/rel="preload" as="image" type="image\/webp" href="\/media\/avatar\/daniel-idle-poster\.webp" fetchpriority="high"/g)?.length, 2);
  assert.doesNotMatch(component, /flow\.google|labs\.google|generativelanguage|veo/i);
});

test("personalization remains session-local and network-independent", () => {
  assert.match(component, /sessionStorage/);
  assert.doesNotMatch(component, /fetch\(|XMLHttpRequest|WebSocket|sendBeacon|localStorage|indexedDB|document\.cookie/);
  assert.doesNotMatch(siteSource, /\bprocess\.env\b/);
  assert.match(siteSource, /viteEnvironment\?\.PUBLIC_SITE_ORIGIN \?\? nodeEnvironment\?\.PUBLIC_SITE_ORIGIN/);
});

test("public labels use job-market language while internal contracts stay unchanged", () => {
  for (const label of ["Constellation of experience", "career records", "Related experience", "View experience", "Show similar work"]) {
    assert.match(component + readFileSync("src/presentation.ts", "utf8"), new RegExp(label));
  }
  for (const internalLabel of ["Selected claim", "Evidence strength", "Source visibility", "Evidence / source"]) {
    assert.doesNotMatch(component, new RegExp(internalLabel));
  }
});
