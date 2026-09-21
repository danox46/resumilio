import type { APIRoute } from "astro";
import type { ResumilioProfile } from "resumilio";
import profileDocument from "../../resumilio.json";
const profile = profileDocument as ResumilioProfile;
export const GET: APIRoute = () => new Response(JSON.stringify({ schemaVersion: profile.schemaVersion, careerItems: profile.careerItems.map(({ id, kind, tags }) => ({ id, kind, tags })), connections: profile.connections }), { headers: { "content-type": "application/json; charset=utf-8" } });
