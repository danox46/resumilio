import { execFileSync, execSync } from "node:child_process";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright";

async function verifyGeneratedMobile(project: string): Promise<void> {
  const root = normalize(join(project, "dist"));
  const types: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml" };
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
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Generated-site QA server did not start.");
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    await page.goto(`http://127.0.0.1:${address.port}/`, { waitUntil: "networkidle" });
    const companion = await page.locator(".resumilio-companion").boundingBox();
    const focus = await page.locator(".focus-node").boundingBox();
    const constellation = await page.locator(".constellation").boundingBox();
    if (!companion || !focus || !constellation) throw new Error("Generated mobile constellation is blank.");
    if (await page.locator(".constellation-actions > *").count() !== 2) throw new Error("Generated resume must show only Classic View and Similar Work actions.");
    if (await page.locator(".constellation-actions").getByRole("link", { name: "GitHub" }).count()) throw new Error("Generated resume inherited the product demo GitHub action.");
    if (constellation.height < 844) throw new Error("Generated mobile constellation is still demo-sized.");
    if (companion.y + companion.height * 0.55 >= focus.y) throw new Error("Generated mobile companion is below the focused record.");
    if (process.env.RESUMILIO_QA_SCREENSHOT) await page.screenshot({ path: process.env.RESUMILIO_QA_SCREENSHOT, fullPage: true });
    const initialTitle = await page.locator(".focus-node h2").innerText();
    await page.locator(".preview-node").first().click();
    await page.waitForTimeout(450);
    if (await page.locator(".focus-node h2").innerText() === initialTitle) throw new Error("Generated mobile node selection did not change the focus.");
    if (Number(await page.locator(".companion-pose--guide-mobile").evaluate((element) => getComputedStyle(element).opacity)) < 0.95) throw new Error("Generated mobile companion did not guide downward.");
    if (await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)) throw new Error("Generated mobile page has horizontal overflow.");
    if (errors.length) throw new Error(`Generated mobile runtime errors: ${errors.join("; ")}`);
  } finally {
    await browser.close();
    await new Promise<void>((done, reject) => server.close((error) => error ? reject(error) : done()));
  }
}

const temporary = await mkdtemp(join(tmpdir(), "resumilio-packed-"));
let tarball = "";
try {
  const packed = JSON.parse(execSync("npm pack --json", { encoding: "utf8" })) as Array<{ filename: string }>;
  tarball = resolve(packed[0].filename);
  const project = join(temporary, "generated-site");
  execFileSync(process.execPath, [resolve("dist/core/cli.js"), "init", project], { stdio: "inherit" });
  execSync(`npm install "${tarball}"`, { cwd: project, stdio: "inherit" });
  const migratedPath = join(temporary, "imported-v2.json");
  execFileSync(process.execPath, [join(project, "node_modules", "resumilio", "dist", "core", "cli.js"), "migrate", resolve("tests/fixtures/reference-v1-fictional.json"), "--out", migratedPath], { cwd: project, stdio: "pipe" });
  const migrated = JSON.parse(await readFile(migratedPath, "utf8")) as { schemaVersion?: string; resources?: Array<{ url?: string }> };
  const migrationReport = JSON.parse(await readFile(`${migratedPath}.migration-report.json`, "utf8")) as { review?: unknown[] };
  if (migrated.schemaVersion !== "2.0.0" || migrated.resources?.length !== 3 || migrated.resources[1].url || migrationReport.review?.length !== 2) throw new Error("Packed CLI migration lost format or privacy guarantees.");
  execSync("npm run check", { cwd: project, stdio: "inherit" });
  execSync("npm run build", { cwd: project, stdio: "inherit" });
  const generatedConfig = JSON.parse(await readFile(join(project, "resumilio.config.json"), "utf8")) as { profile?: string };
  if (generatedConfig.profile !== "resumilio.json") throw new Error("Generated config points at the wrong profile document.");
  for (const path of ["README.md", "dist/index.html", "dist/classic/index.html", "dist/es/index.html", "dist/profile.json", "dist/graph.json", "dist/llms.txt"]) {
    if (!existsSync(join(project, path))) throw new Error(`Generated package is missing ${path}`);
  }
  await verifyGeneratedMobile(project);
  console.log(JSON.stringify({ ok: true, generatedRoutes: 6, mobileCompanionAboveFocus: true, mobileNodeSelection: true }, null, 2));
} finally {
  if (tarball) await rm(tarball, { force: true });
  await rm(temporary, { recursive: true, force: true });
}
