#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createResumilioMcpServer } from "./mcp.js";

const index = process.argv.indexOf("--profile");
const profilePath = index === -1 ? "resumilio.json" : process.argv[index + 1];
if (!profilePath) throw new Error("--profile requires a path");
const server = createResumilioMcpServer(profilePath);
await server.connect(new StdioServerTransport());
