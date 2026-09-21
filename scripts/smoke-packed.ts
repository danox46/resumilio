import { execFileSync, execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const temporary = await mkdtemp(join(tmpdir(), "resumilio-packed-"));
let tarball = "";
try {
  const packed = JSON.parse(execSync("npm pack --json", { encoding: "utf8" })) as Array<{ filename: string }>;
  tarball = resolve(packed[0].filename);
  const project = join(temporary, "generated-site");
  execFileSync(process.execPath, [resolve("dist/core/cli.js"), "init", project], { stdio: "inherit" });
  execSync(`npm install "${tarball}"`, { cwd: project, stdio: "inherit" });
  execSync("npm run check", { cwd: project, stdio: "inherit" });
  execSync("npm run build", { cwd: project, stdio: "inherit" });
  for (const path of ["dist/index.html", "dist/classic/index.html", "dist/es/index.html", "dist/profile.json", "dist/graph.json", "dist/llms.txt"]) {
    if (!existsSync(join(project, path))) throw new Error(`Generated package is missing ${path}`);
  }
  console.log(JSON.stringify({ ok: true, generatedRoutes: 6 }, null, 2));
} finally {
  if (tarball) await rm(tarball, { force: true });
  await rm(temporary, { recursive: true, force: true });
}
