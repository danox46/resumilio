import { execFileSync, spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const tarball = resolve(process.argv[2] ?? "");
if (!process.argv[2]) throw new Error("Pass the packed .tgz path.");
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("Run this script through npm so its executable can be resolved safely.");
const sandbox = await mkdtemp(resolve(tmpdir(), "resumilio-pack-"));

function cli(...args: string[]): string {
  return execFileSync(process.execPath, [resolve(sandbox, "node_modules/resumilio/dist/cli.js"), ...args], { cwd: sandbox, encoding: "utf8" });
}

try {
  execFileSync(process.execPath, [npmCli, "init", "--yes"], { cwd: sandbox, stdio: "ignore" });
  execFileSync(process.execPath, [npmCli, "install", "--ignore-scripts", tarball], { cwd: sandbox, stdio: "inherit" });
  if (cli("--version").trim() !== "0.8.0") throw new Error("Packed CLI version does not match 0.8.0.");
  cli("init", ".", "--level", "nontechnical");
  cli("validate");
  cli("preview", "--output", "preview", "--locale", "es");
  cli("export", "--format", "markdown", "--output", "profile.md", "--locale", "en");
  cli("deploy", "--output", "deploy", "--locale", "en");
  const profile = JSON.parse(await readFile(resolve(sandbox, "resumilio.json"), "utf8"));
  profile.profile.headline.en = "Tarball smoke test";
  await writeFile(resolve(sandbox, "resumilio.json"), JSON.stringify(profile), "utf8");
  cli("validate");

  const mcp = spawn(process.execPath, [resolve(sandbox, "node_modules/resumilio/dist/mcp-server.js"), "--profile", "resumilio.json"], { cwd: sandbox, stdio: "ignore" });
  await new Promise<void>((accept, reject) => {
    let intentionalStop = false;
    const timer = setTimeout(() => { intentionalStop = true; mcp.kill(); }, 500);
    mcp.once("error", (error) => { clearTimeout(timer); reject(error); });
    mcp.once("exit", (code) => { clearTimeout(timer); intentionalStop || code === 0 ? accept() : reject(new Error(`MCP binary exited with ${code}.`)); });
  });
  console.log(JSON.stringify({ ok: true, tarball, commands: ["init", "validate", "preview", "export", "deploy"], binaries: ["resumilio", "resumilio-mcp"], noKey: true }, null, 2));
} finally {
  await rm(sandbox, { recursive: true, force: true });
}
