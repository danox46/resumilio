import type { APIRoute } from "astro";
import profile from "../../resumilio.json";
export const GET: APIRoute = () => new Response(JSON.stringify(profile), { headers: { "content-type": "application/json; charset=utf-8" } });
