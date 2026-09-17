import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const component = readFileSync("src/components/ResumilioBrandPage.astro", "utf8");
const englishPage = readFileSync("src/pages/about/index.astro", "utf8");
const spanishPage = readFileSync("src/pages/es/acerca/index.astro", "utf8");
const styles = readFileSync("src/styles/brand.css", "utf8");
const sitemap = readFileSync("src/pages/sitemap.xml.ts", "utf8");
const deploymentVerifier = readFileSync("scripts/verify-deployment.ts", "utf8");
const releaseVerifier = readFileSync("scripts/verify-release-build.ts", "utf8");

test("the product page keeps the person ahead of the engine", () => {
  assert.match(component, /titleLead: "Your career,"/);
  assert.match(component, /titleAccent: "in motion\."/);
  assert.match(component, /titleLead: "Tu carrera,"/);
  assert.match(component, /titleAccent: "en movimiento\."/);
  assert.doesNotMatch(component, /still yours|sigue siendo tuya/i);
  assert.match(component, /Person first/);
  assert.match(component, /La persona primero/);
  assert.match(component, /Useful without AI/);
  assert.match(component, /Útil sin IA/);
  assert.match(component, /Agent assisted/);
  assert.match(component, /Con agentes/);
});

test("the landing page sells outcomes while setup lives on its own bilingual page", () => {
  assert.match(component, /A new visual experience/);
  assert.match(component, /A classic resume, ready/);
  assert.match(component, /Recommendations that react/);
  assert.match(component, /Una nueva experiencia visual/);
  assert.match(component, /Una hoja de vida clásica, lista/);
  assert.match(component, /Recomendaciones que reaccionan/);
  assert.match(component, /\/how-to\//);
  assert.match(component, /\/es\/como-usar\//);
  assert.ok(existsSync("src/pages/how-to/index.astro"));
  assert.ok(existsSync("src/pages/es/como-usar/index.astro"));
  assert.ok(existsSync("src/components/ResumilioHowToPage.astro"));
  const howTo = readFileSync("src/components/ResumilioHowToPage.astro", "utf8");
  assert.match(howTo, /resumilio init my-profile/);
  assert.match(howTo, /resumilio validate/);
  assert.match(howTo, /resumilio preview/);
  assert.match(howTo, /resumilio export --format markdown/);
  assert.match(howTo, /does not publish|no publica/i);
  assert.match(deploymentVerifier, /path: "\/how-to\/"/);
  assert.match(deploymentVerifier, /path: "\/es\/como-usar\/"/);
  assert.match(releaseVerifier, /"how-to\/index\.html"/);
  assert.match(releaseVerifier, /"es\/como-usar\/index\.html"/);
  assert.match(sitemap, /howToPath/);
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
  assert.match(styles, /\.brand-mark-line--fold \{[^}]*stroke-width: 1\.18;/s);
  assert.doesNotMatch(styles, /brand-mark-depth/);
  assert.match(styles, /--brand-paper: #f6f2e9;/);
  assert.match(styles, /--brand-ink: #1c2433;/);
  assert.match(styles, /--brand-amber: #c17a12;/);
  assert.match(styles, /--brand-orbit: #5573a7;/);
  assert.match(styles, /--brand-leaf: #426b50;/);
  assert.match(styles, /--brand-line: #d3d8e1;/);
  assert.match(styles, /\.proof-lines path, \.proof-lines ellipse \{[^}]*stroke: var\(--brand-orbit\);/s);
  assert.match(component, /data-proof-orbit/);
  assert.equal(component.match(/data-proof-card/g)?.length, 2);
  assert.match(component, /focusItems:/);
  assert.match(component, /\["Open source", "Built for everyone", "source"\]/);
  assert.match(component, /\["Código abierto", "Creado para todos", "source"\]/);
  assert.match(component, /data-role=\{index === 0 \? "focus" : "orbit"\}/);
  assert.match(component, /data-icon=\{icon\}/);
  assert.match(component, /setInterval\(advanceFocus, 6200\)/);
  assert.match(component, /prefers-reduced-motion: reduce/);
  assert.match(styles, /\.proof-card\[data-role="focus"\]/);
  assert.match(styles, /\.proof-card\[data-role="orbit"\]\[data-position="1"\]/);
  assert.match(styles, /left 1400ms cubic-bezier\(\.22, 1, \.36, 1\)/);
  assert.match(styles, /@media \(max-width: 760px\)/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(component, /<img|stock|unsplash/i);
});
