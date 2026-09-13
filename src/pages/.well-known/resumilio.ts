import { publicProfile } from "../../endpoint-data";
import { buildDiscoveryManifest, jsonResponse } from "../../public-contracts";
export const prerender = true;
export const GET = () => jsonResponse(buildDiscoveryManifest(publicProfile), "en");
