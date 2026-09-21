import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { ResumilioProfile } from "../core/profile.js";
import { readProfile, upsertCareerItem } from "../core/operations.js";

test("MCP operations create items and reject stale revisions", async () => {
  const directory = await mkdtemp(join(tmpdir(), "resumilio-ops-"));
  try {
    const path = join(directory, "resumilio.json");
    await writeFile(path, await readFile("profiles/demo.json", "utf8"));
    const initial = await readProfile(path);
    const item: ResumilioProfile["careerItems"][number] = { id: "new-publication", kind: "publication", state: "available", title: { en: "New publication", es: "Nueva publicación" }, summary: { en: "A fictional publication.", es: "Una publicación ficticia." }, resourceIds: [], tags: ["writing"] };
    const updated = await upsertCareerItem(path, item, initial.revision);
    assert.notEqual(updated.revision, initial.revision);
    await assert.rejects(() => upsertCareerItem(path, { ...item, summary: { en: "Changed", es: "Cambiado" } }, initial.revision), /Revision conflict/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
