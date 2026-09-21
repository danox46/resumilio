import type { APIRoute } from "astro";
export const GET: APIRoute = () => new Response("# Resumilio\n\nOpen-source living resume engine. The public demo is fictional.\n\n- Product: /\n- Demo: /demo/\n- How to use: /how-to/\n- Profile data: /profile.json\n- Career graph: /graph.json\n", { headers: { "content-type": "text/plain; charset=utf-8" } });
