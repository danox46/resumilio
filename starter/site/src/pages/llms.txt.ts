import type { APIRoute } from "astro";
import type { ResumilioProfile } from "resumilio";
import profileDocument from "../../resumilio.json";
const profile = profileDocument as ResumilioProfile;
export const GET: APIRoute = () => new Response(`# ${profile.profile.name[profile.profile.defaultLocale]}\n\n${profile.profile.headline[profile.profile.defaultLocale]}\n\nPublic career profile: /profile.json\nCareer graph: /graph.json\n`, { headers: { "content-type": "text/plain; charset=utf-8" } });
