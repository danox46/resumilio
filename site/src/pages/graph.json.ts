import type { APIRoute } from "astro";
import profile from "../../../profiles/demo.json";
export const GET: APIRoute = () => new Response(JSON.stringify({ fictional: true, careerItems: profile.careerItems.map(({ id, kind, tags }) => ({ id, kind, tags })), connections: profile.connections }), { headers: { "content-type": "application/json; charset=utf-8" } });
