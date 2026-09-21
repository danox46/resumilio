# Resumilio

**Your career, in motion.**

Resumilio is an open-source living resume: an interactive career constellation, a conventional print-friendly resume, and an open profile format that works with or without an agent.

[Product and fictional demo](https://resumilio.danienremoto.com) · [How to use it](https://resumilio.danienremoto.com/how-to/)

## Create a site

```bash
npx resumilio@latest init my-resume
cd my-resume
npm install
npm run dev
```

The generated project includes:

- Responsive constellation discovery with four mobile and five desktop preview nodes.
- A removable illustrated sprite companion that reacts to navigation without WebGL.
- A classic resume route designed for printing and eventual PDF export.
- Configured-locale routes and machine-readable profile, graph, search, and LLM endpoints.
- A local Resumilio authoring skill and project-level agent instructions.
- A clearly fictional starter profile using reserved example URLs.

No model key is required.

## Author manually or with an agent

Edit `resumilio.json`, then run:

```bash
npx resumilio validate resumilio.json
npm run build
```

Agents can use the stdio MCP server:

```bash
npx resumilio-mcp
```

The MCP can read the current revision, update identity and contacts, upsert organizations, career items, resources, and connections, and validate the resulting graph. To make the bundled skill globally discoverable by Codex, opt in explicitly:

```bash
npx resumilio agent install codex
```

Initialization never changes global agent configuration.

## Companion animation

The default companion uses one transparent CSS sprite atlas, not canvas or WebGL. Its six rows cover idle, waiting, nod, smile, wide-screen guidance, and mobile downward guidance. Replace `public/images/resumilio-companion-sprite.png` with another 4-by-6 atlas that preserves the 256-pixel square cell layout, or disable the companion in `resumilio.config.json` without affecting the constellation.

## Public resources, not private files

Resumilio links to recruiter-useful public destinations: live demos, external previews, public repositories, online certificates, and work samples. NDA-protected work can have a safe public summary without a URL. Private source files, notes, customer details, credentials, and local paths do not belong in the public profile.

## Hosting

`npm run build` produces a static `dist/` directory that can be hosted on any static provider. Cloudflare Pages is the maintained example; Resumilio does not require Cloudflare.

## License

Software is available under the [MIT License](LICENSE). The Resumilio name and marks are covered by [TRADEMARKS.md](TRADEMARKS.md).
