import type { APIRoute } from "astro";
import type { ResumilioProfile } from "resumilio";
import profileDocument from "../../resumilio.json";
const profile = profileDocument as ResumilioProfile;
export const GET: APIRoute = () => new Response(JSON.stringify(profile.careerItems.map(({ id, kind, title, summary, tags }) => ({ id, kind, title, summary, tags }))), { headers: { "content-type": "application/json; charset=utf-8" } });
