#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createResumilioMcpServer } from "./mcp.js";

const server = createResumilioMcpServer(process.env.RESUMILIO_PROFILE ?? "resumilio.json");
await server.connect(new StdioServerTransport());
