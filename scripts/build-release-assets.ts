import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("Run this script through npm so its executable can be resolved safely.");
const npm = (...args: string[]) => execFileSync(process.execPath, [npmCli, ...args], { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
const output = resolve("release-artifacts");
await mkdir(output, { recursive: true });
const packed = JSON.parse(npm("pack", "--json", "--pack-destination", output));
const tarball = resolve(output, packed[0].filename);
execFileSync(process.execPath, ["--import", "tsx", "scripts/verify-packed-package.ts", tarball], { stdio: "inherit" });
const bytes = await readFile(tarball);
const checksum = `${createHash("sha256").update(bytes).digest("hex")}  ${packed[0].filename}\n`;
await writeFile(resolve(output, "SHA256SUMS.txt"), checksum, "utf8");
const sbom = npm("sbom", "--sbom-format", "cyclonedx");
await writeFile(resolve(output, "resumilio-0.8.0.cdx.json"), sbom, "utf8");
console.log(JSON.stringify({ tarball, checksum: checksum.trim(), sbom: resolve(output, "resumilio-0.8.0.cdx.json") }, null, 2));
