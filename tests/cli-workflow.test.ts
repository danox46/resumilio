import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repository = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const resumilioCli = resolve(repository, "dist/cli.js");

function run(cwd: string, ...args: string[]) {
  const result = spawnSync(process.execPath, [resumilioCli, ...args], { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, `${args.join(" ")} failed:\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

test("all CLI commands complete a fresh-directory no-key workflow", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "resumilio-cli-"));
  try {
    run(directory, "init", ".", "--level", "nontechnical");
    const imported = JSON.parse(await readFile(resolve(directory, "resumilio.json"), "utf8"));
    imported.profile.headline.en = "Imported factual headline";
    await writeFile(resolve(directory, "import.json"), JSON.stringify(imported), "utf8");
    run(directory, "ingest", "import.json", "--profile", "resumilio.json");
    const bundle = {
      kind: "claim-bundle",
      claims: [{
        id: "claim-second-project", type: "project", lifecycle: "completed",
        title: { en: "Second project", es: "Segundo proyecto" },
        summary: { en: "A second supported result.", es: "Un segundo resultado verificable." },
        evidenceIds: ["evidence-second-project"], tags: ["example"],
      }],
      evidence: [{
        id: "evidence-second-project", claimIds: ["claim-second-project"],
        title: { en: "Second attestation", es: "Segunda declaración" },
        evidenceType: "owner-attestation", strength: "self-attested", lifecycle: "restricted",
        source: { label: { en: "Public summary", es: "Resumen público" }, visibility: "public-summary" },
        observedAt: "2026-09-12",
      }],
    };
    await writeFile(resolve(directory, "bundle.json"), JSON.stringify(bundle), "utf8");
    run(directory, "ingest", "bundle.json", "--profile", "resumilio.json");
    const validation = JSON.parse(run(directory, "validate"));
    assert.equal(validation.graphHealth.navigationGuaranteed, true);
    assert.equal(validation.graphHealth.minimumReachableClaims, 2);
    run(directory, "preview", "--output", "preview", "--locale", "es");
    run(directory, "export", "--format", "markdown", "--output", "exports/profile.md", "--locale", "en");
    const doctor = JSON.parse(run(directory, "doctor"));
    assert.equal(doctor.checks.find((check: { check: string }) => check.check === "constellation-navigation")?.ok, true);
    run(directory, "deploy", "--output", "deploy", "--locale", "en");
    assert.match(await readFile(resolve(directory, "preview/index.html"), "utf8"), /lang="es"/);
    assert.match(await readFile(resolve(directory, "exports/profile.md"), "utf8"), /Imported factual headline/);
    const deployed = JSON.parse(await readFile(resolve(directory, "deploy/profile.json"), "utf8"));
    assert.equal(deployed.profile.headline.en, "Imported factual headline");
    assert.equal(deployed.claims.length, 2);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
