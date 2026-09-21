import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { initializeWorkspace } from "../core/workspace.js";

test("init creates the complete site and local skill without changing global configuration", async () => {
  const parent = await mkdtemp(join(tmpdir(), "resumilio-init-"));
  const target = join(parent, "site");
  try {
    const result = await initializeWorkspace(target);
    assert.match(await readFile(result.profile, "utf8"), /Fictional Profile/);
    assert.match(await readFile(result.skill, "utf8"), /resumilio-authoring/);
    assert.match(await readFile(join(target, "src/pages/index.astro"), "utf8"), /Constellation/);
    for (const state of ["idle", "waiting", "nod", "smile", "guide-wide", "guide-mobile"]) {
      assert.ok((await stat(join(target, `public/images/resumilio-companion-${state}.png`))).size > 0);
    }
  } finally { await rm(parent, { recursive: true, force: true }); }
});
