import { absoluteUrl } from "../site";
import { textResponse } from "../public-contracts";
export const prerender = true;
export const GET = () => textResponse(`User-agent: *\nAllow: /\nSitemap: ${absoluteUrl("/sitemap.xml")}`, "en");
