import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const component = readFileSync("src/components/EvidenceExplorer.tsx", "utf8");
const styles = readFileSync("src/styles/global.css", "utf8");

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
  assert.match(component, /aria-describedby="graph-help"/);
  assert.match(component, /className="sr-only" id="graph-help"/);
});

test("personalization remains session-local and network-independent", () => {
  assert.match(component, /sessionStorage/);
  assert.doesNotMatch(component, /fetch\(|XMLHttpRequest|WebSocket|sendBeacon|localStorage|indexedDB|document\.cookie/);
});
