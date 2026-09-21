# Architecture

Resumilio has four deliberately separate layers:

1. `core/` defines the public profile, validation, graph navigation, CLI, and MCP.
2. `ui/` provides reusable React constellation, companion, and classic-resume components.
3. `starter/site/` is the complete Astro project copied by `resumilio init`.
4. `site/` is the Resumilio product home and fictional demonstration.

The public profile contains publishable career content only. Presentation settings live in `resumilio.config.json`; private source material stays outside the project.
