import { createHash } from "node:crypto";

const origins = process.argv.slice(2).map((value) => value.replace(/\/+$/, ""));
if (origins.length === 0) throw new Error("Pass one or more deployment origins to verify.");

const routes = [
  { path: "/", type: "text/html", language: null },
  { path: "/es/", type: "text/html", language: null },
  { path: "/resume.json", type: "application/json", language: "en" },
  { path: "/es/resume.json", type: "application/json", language: "es" },
  { path: "/evidence.json", type: "application/json", language: "en" },
  { path: "/es/evidence.json", type: "application/json", language: "es" },
  { path: "/graph.json", type: "application/json", language: "en" },
  { path: "/es/graph.json", type: "application/json", language: "es" },
  { path: "/.well-known/resumilio.json", type: "application/json", language: "en" },
  { path: "/llms.txt", type: "text/plain", language: "en" },
  { path: "/es/llms.txt", type: "text/plain", language: "es" },
  { path: "/evidence/claim-professional-ai-text-completion/", type: "text/html", language: null },
  { path: "/es/evidencia/claim-professional-ai-text-completion/", type: "text/html", language: null },
];

const forbidden = [
  new RegExp(["codex-control", "-plane-pilot"].join(""), "i"),
  new RegExp(["C:", "\\\\", "Users", "\\\\"].join(""), "i"),
  new RegExp(["-----BEGIN ", "PRIVATE KEY-----"].join(""), "i"),
  new RegExp(["Bear", "er\\s+[A-Za-z0-9._-]{16,}"].join(""), "i"),
  new RegExp(["(?:^|[\"'])", "te", "l:"].join(""), "i"),
];
const reports: Array<{ origin: string; routes: Array<{ path: string; sha256: string; contentType: string; contentLanguage: string | null; cacheControl: string | null }> }> = [];

for (const origin of origins) {
  const report = { origin, routes: [] as Array<{ path: string; sha256: string; contentType: string; contentLanguage: string | null; cacheControl: string | null }> };
  for (const route of routes) {
    const response = await fetch(`${origin}${route.path}`, { redirect: "follow" });
    if (!response.ok) throw new Error(`${origin}${route.path} returned ${response.status}.`);
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes(route.type)) throw new Error(`${route.path} returned ${contentType}; expected ${route.type}.`);
    if (route.language && response.headers.get("content-language") !== route.language) throw new Error(`${route.path} has the wrong Content-Language.`);
    if (route.language && !response.headers.get("cache-control")?.includes("s-maxage=")) throw new Error(`${route.path} is missing shared-cache policy.`);
    if (route.language && response.headers.get("x-content-type-options") !== "nosniff") throw new Error(`${route.path} is missing nosniff.`);
    const body = await response.text();
    if (forbidden.some((signature) => signature.test(body))) throw new Error(`${route.path} contains a forbidden public signature.`);
    if (route.type === "application/json") JSON.parse(body);
    report.routes.push({
      path: route.path,
      sha256: createHash("sha256").update(body).digest("hex"),
      contentType,
      contentLanguage: response.headers.get("content-language"),
      cacheControl: response.headers.get("cache-control"),
    });
  }
  reports.push(report);
}

if (reports.length > 1) {
  const baseline = reports[0].routes;
  for (const report of reports.slice(1)) {
    for (const [index, route] of report.routes.entries()) {
      if (route.sha256 !== baseline[index].sha256) throw new Error(`${route.path} differs between ${reports[0].origin} and ${report.origin}.`);
    }
  }
}

console.log(JSON.stringify({ equivalent: true, routeCount: routes.length, reports }, null, 2));
