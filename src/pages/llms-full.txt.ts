import { llmsEndpoint } from "../endpoint-data";
export const prerender = true;
export const GET = () => llmsEndpoint("en", true);
