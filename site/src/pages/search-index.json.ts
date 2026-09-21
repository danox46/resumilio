import type { APIRoute } from "astro";
import profile from "../../../profiles/demo.json";
export const GET: APIRoute = () => new Response(JSON.stringify(profile.careerItems.map(({ id, kind, title, summary, tags }) => ({ id, kind, title, summary, tags }))), { headers: { "content-type": "application/json; charset=utf-8" } });
