import profileSchema from "../../../schemas/profile.v1.schema.json";
import resumeSchema from "../../../schemas/resume.v1.schema.json";
import evidenceSchema from "../../../schemas/evidence.v1.schema.json";
import graphSchema from "../../../schemas/graph.v1.schema.json";
import searchSchema from "../../../schemas/search-index.v1.schema.json";
import discoverySchema from "../../../schemas/discovery.v1.schema.json";
import { jsonResponse } from "../../public-contracts";

const schemas = {
  "profile.v1.schema": profileSchema,
  "resume.v1.schema": resumeSchema,
  "evidence.v1.schema": evidenceSchema,
  "graph.v1.schema": graphSchema,
  "search-index.v1.schema": searchSchema,
  "discovery.v1.schema": discoverySchema,
};

export const prerender = true;
export function getStaticPaths() {
  return Object.keys(schemas).map((schema) => ({ params: { schema } }));
}
export const GET = ({ params }: { params: { schema: keyof typeof schemas } }) => jsonResponse(schemas[params.schema], "en");
