import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import { buildDeploymentArtifacts } from "../src/rendering.js";
import { initializeWorkspace, loadValidProfile, type ExperienceLevel } from "../src/workspace.js";

test("all experience levels produce an equivalent public artifact", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "resumilio-levels-"));
  try {
    const levels: ExperienceLevel[] = ["nontechnical", "intermediate", "advanced"];
    const artifacts: string[] = [];
    for (const level of levels) {
      const directory = resolve(root, level);
      const { profilePath } = await initializeWorkspace(directory, level);
      const profile = await loadValidProfile(profilePath);
      const output = resolve(directory, "deploy");
      await buildDeploymentArtifacts(profile, output, "en");
      artifacts.push(await readFile(resolve(output, "profile.json"), "utf8"));
    }
    assert.equal(new Set(artifacts).size, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
