import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import test from "node:test";

const component = readFileSync("src/components/EvidenceExplorer.tsx", "utf8");
const styles = readFileSync("src/styles/global.css", "utf8");
const entryPages = readFileSync("src/pages/index.astro", "utf8") + readFileSync("src/pages/es/index.astro", "utf8");

test("claim controls expose directional keyboard navigation", () => {
  for (const key of ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"]) {
    assert.match(component, new RegExp(`\\\"${key}\\\"`));
  }
  assert.match(component, /onKeyDown=\{\(event\) => moveClaimFocus\(event, claim\)\}/);
  assert.match(component, /disabled=\{hidden\}/);
});

test("visual motion and focus have accessible alternatives", () => {
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
  assert.match(styles, /\.avatar-video \{ display: none; \}/);
  assert.match(component, /aria-describedby="graph-help"/);
  assert.match(component, /className="sr-only" id="graph-help"/);
});

test("the avatar uses bounded local media for shared and responsive reactions", () => {
  for (const name of ["daniel-idle.mp4", "daniel-waiting.mp4", "daniel-nod.mp4", "daniel-smile.mp4", "daniel-guide-wide.mp4", "daniel-guide-stacked.mp4", "daniel-idle-poster.webp"]) {
    const path = `public/media/avatar/${name}`;
    assert.ok(existsSync(path), `${path} is missing`);
    assert.ok(statSync(path).size > 0, `${path} is empty`);
  }
  assert.match(component, /data-avatar-state=\{reaction\}/);
  assert.match(component, /onFocus=\{\(\) => showReaction\("nod"\)\}/);
  assert.match(component, /onMouseEnter=\{\(\) => showReaction\("nod"\)\}/);
  assert.match(component, /showReaction\("guide"\)/);
  assert.match(component, /stackedAvatarQuery = "\(max-width: 820px\)"/);
  assert.match(component, /media\.addEventListener\("change", syncLayout\)/);
  assert.match(component, /data-avatar-variant=\{reaction === "guide" \? layout : "shared"\}/);
  assert.match(styles, /\.avatar-mobile-callout \{ position: absolute;/);
  assert.match(component, /showReaction\("smile"\)/);
  assert.match(component, /showReaction\("waiting"\)/);
  assert.match(component, /waitingReactionDelayMs = 24_000/);
  assert.match(component, /addEventListener\("pointermove", beginMotion/);
  assert.match(component, /addEventListener\("keydown", beginMotion/);
  assert.match(component, /addEventListener\("touchstart", beginMotion/);
  assert.equal(entryPages.match(/rel="preload" as="image" type="image\/webp" href="\/media\/avatar\/daniel-idle-poster\.webp" fetchpriority="high"/g)?.length, 2);
  assert.doesNotMatch(component, /flow\.google|labs\.google|generativelanguage|veo/i);
});

test("personalization remains session-local and network-independent", () => {
  assert.match(component, /sessionStorage/);
  assert.doesNotMatch(component, /fetch\(|XMLHttpRequest|WebSocket|sendBeacon|localStorage|indexedDB|document\.cookie/);
});

test("public labels use job-market language while internal contracts stay unchanged", () => {
  for (const label of ["Career highlights", "Professional experience", "Career status", "How it's documented", "More about it", "Related work"]) {
    assert.match(component + readFileSync("src/presentation.ts", "utf8"), new RegExp(label));
  }
  for (const internalLabel of ["Selected claim", "Evidence strength", "Source visibility", "Evidence / source"]) {
    assert.doesNotMatch(component, new RegExp(internalLabel));
  }
});
