import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createResumilioMcpServer } from "../src/mcp.js";

const repository = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("local MCP exposes bounded profile tools and builds sanitized artifacts", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "resumilio-mcp-"));
  const profilePath = resolve(directory, "profile.json");
  await cp(resolve(repository, "profiles/starter.json"), profilePath);
  const server = createResumilioMcpServer(profilePath);
  const client = new Client({ name: "resumilio-contract-test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    const tools = await client.listTools();
    assert.deepEqual(tools.tools.map((tool) => tool.name).sort(), [
      "claims_validate", "deployment_artifacts_build", "preview_build", "profile_read", "profile_update_claim", "source_link",
    ]);
    assert.doesNotMatch(JSON.stringify(tools.tools), /password|cookie|authorization header|private key/i);
    const read = await client.callTool({ name: "profile_read", arguments: {} });
    assert.match(JSON.stringify(read.content), /your-name/);
    const starter = JSON.parse(await readFile(profilePath, "utf8"));
    starter.claims[0].summary.en = "Updated through the bounded MCP operation.";
    await client.callTool({ name: "profile_update_claim", arguments: { claim: starter.claims[0] } });
    await client.callTool({
      name: "source_link",
      arguments: {
        claimId: "claim-first-project", evidenceId: "evidence-public-example", url: "https://github.com/example/project",
        labelEn: "Public project source", labelEs: "Fuente pública del proyecto", observedAt: "2026-09-12",
      },
    });
    const validation = await client.callTool({ name: "claims_validate", arguments: {} });
    const content = validation.content as Array<{ type: string; text?: string }>;
    const validationText = content.find((item) => item.type === "text")?.text ?? "{}";
    assert.equal(JSON.parse(validationText).valid, true);
    await client.callTool({ name: "preview_build", arguments: { outputDirectory: resolve(directory, "preview"), locale: "es" } });
    await client.callTool({ name: "deployment_artifacts_build", arguments: { outputDirectory: resolve(directory, "deploy"), locale: "en" } });
    assert.match(await readFile(resolve(directory, "preview/index.html"), "utf8"), /lang="es"/);
    const deployment = await readFile(resolve(directory, "deploy/profile.json"), "utf8");
    assert.doesNotMatch(deployment, /BEGIN PRIVATE KEY|Bearer\s+[A-Za-z0-9._-]{16,}/i);
  } finally {
    await client.close().catch(() => undefined);
    await server.close().catch(() => undefined);
    await rm(directory, { recursive: true, force: true });
  }
});
