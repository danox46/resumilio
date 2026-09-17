import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const component = readFileSync("src/components/ResumilioBrandPage.astro", "utf8");
const englishPage = readFileSync("src/pages/about/index.astro", "utf8");
const spanishPage = readFileSync("src/pages/es/acerca/index.astro", "utf8");
const styles = readFileSync("src/styles/brand.css", "utf8");
const deploymentVerifier = readFileSync("scripts/verify-deployment.ts", "utf8");
const releaseVerifier = readFileSync("scripts/verify-release-build.ts", "utf8");

test("the product page keeps the person ahead of the engine", () => {
  assert.match(component, /titleLead: "Your experience,"/);
  assert.match(component, /titleAccent: "still yours\."/);
  assert.match(component, /titleLead: "Tu experiencia"/);
  assert.match(component, /titleAccent: "sigue siendo tuya\."/);
  assert.match(component, /Person first/);
  assert.match(component, /La persona primero/);
  assert.match(component, /Useful without AI/);
  assert.match(component, /Útil sin IA/);
  assert.match(component, /agents can help maintain/);
  assert.match(component, /agentes pueden ayudar a mantener/);
});

test("English and Spanish pages have symmetric discovery metadata", () => {
  assert.match(englishPage, /locale="en"/);
  assert.match(spanishPage, /locale="es"/);
  assert.match(component, /hreflang="en"/);
  assert.match(component, /hreflang="es"/);
  assert.match(component, /hreflang="x-default"/);
  assert.match(component, /\/about\//);
  assert.match(component, /\/es\/acerca\//);
  assert.match(deploymentVerifier, /path: "\/about\/"/);
  assert.match(deploymentVerifier, /path: "\/es\/acerca\/"/);
  assert.match(releaseVerifier, /"about\/index\.html"/);
  assert.match(releaseVerifier, /"es\/acerca\/index\.html"/);
});

test("the brand page offers a real profile and public source", () => {
  assert.match(component, /Explore a live profile/);
  assert.match(component, /Explora un perfil real/);
  assert.match(component, /https:\/\/github\.com\/danox46\/resumilio/);
  assert.match(component, /Open source/);
  assert.match(component, /Código abierto/);
});

test("the identity is native, responsive, and motion-safe", () => {
  assert.match(component, /class="brand-mark"/);
  assert.match(component, /class="brand-mark-line brand-mark-line--spine"/);
  assert.match(component, /class="brand-mark-line brand-mark-line--fold"/);
  assert.equal(component.match(/class="brand-mark-taper"/g)?.length, 4);
  assert.match(styles, /\.brand-mark \.brand-mark-taper \{[^}]*fill: var\(--brand-amber\);/s);
  assert.match(styles, /\.brand-mark-line--spine \{[^}]*stroke-width: 1\.45;/s);
  assert.match(styles, /\.brand-mark-line--fold \{[^}]*stroke-width: \.68;/s);
  assert.doesNotMatch(styles, /brand-mark-depth/);
  assert.match(styles, /--brand-amber:/);
  assert.match(styles, /@media \(max-width: 760px\)/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(component, /<img|stock|unsplash/i);
});
