import type { LocalizedText, ResumilioProfile } from "./profile.js";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const datePattern = /^\d{4}(?:-\d{2}(?:-\d{2})?)?$/;
const observedAtPattern = /^\d{4}-\d{2}-\d{2}$/;
const careerStates = new Set(["current", "available", "completed", "in-development", "archived", "idea", "proposal", "working-prelaunch", "shipped", "production", "retired"]);
const resourceKinds = new Set(["live-demo", "external-preview", "public-repository", "online-certificate", "work-sample", "nda-protected", "career-note"]);
const resourceAvailabilities = new Set(["public", "restricted", "unavailable"]);
const connectionKinds = new Set(["related-to", "built-on", "performed-for", "learned-through", "provided-by", "supports"]);
const provenanceTypes = new Set(["public-source", "owner-attestation", "repository", "credential", "artifact"]);
const provenanceStrengths = new Set(["self-attested", "corroborated", "primary"]);
const provenanceLifecycles = new Set(["available", "restricted", "archived", "unavailable"]);
const provenanceVisibilities = new Set(["public", "public-summary", "private-reference"]);

function checkLocalized(value: unknown, locales: string[], path: string, errors: string[]): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push(`${path} must be a localized text object.`);
    return;
  }
  const text = value as LocalizedText;
  for (const locale of locales) if (!text[locale]?.trim()) errors.push(`${path}.${locale} is required.`);
}

function checkId(value: unknown, path: string, errors: string[]): value is string {
  if (typeof value !== "string" || !idPattern.test(value)) {
    errors.push(`${path} must be a stable kebab-case ID.`);
    return false;
  }
  return true;
}

export function validateProfileDocument(value: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) return { valid: false, errors: ["Profile must be an object."], warnings };
  const document = value as Partial<ResumilioProfile>;
  if (document.schemaVersion !== "2.0.0") errors.push("schemaVersion must be 2.0.0. Use `resumilio migrate` for a v1 profile.");
  const person = document.profile;
  if (!person) errors.push("profile is required.");
  const locales = person?.locales;
  if (!Array.isArray(locales) || locales.length < 1 || locales.some((locale) => typeof locale !== "string" || !locale.trim())) {
    errors.push("profile.locales must contain at least one locale code.");
  }
  const localeList = Array.isArray(locales) ? [...new Set(locales)] : [];
  if (person) {
    checkId(person.id, "profile.id", errors);
    if (!localeList.includes(person.defaultLocale)) errors.push("profile.defaultLocale must be listed in profile.locales.");
    checkLocalized(person.name, localeList, "profile.name", errors);
    checkLocalized(person.headline, localeList, "profile.headline", errors);
    checkLocalized(person.summary, localeList, "profile.summary", errors);
    if (!Array.isArray(person.contacts) || person.contacts.length < 1) errors.push("profile.contacts must contain at least one contact route.");
    for (const [index, contact] of (person.contacts ?? []).entries()) {
      checkId(contact.id, `profile.contacts[${index}].id`, errors);
      checkLocalized(contact.label, localeList, `profile.contacts[${index}].label`, errors);
      if (!/^(https:\/\/|mailto:)[^\s]+$/.test(contact.url)) errors.push(`profile.contacts[${index}].url must use https or mailto.`);
    }
  }

  const organizations = Array.isArray(document.organizations) ? document.organizations : [];
  const careerItems = Array.isArray(document.careerItems) ? document.careerItems : [];
  const resources = Array.isArray(document.resources) ? document.resources : [];
  const connections = Array.isArray(document.connections) ? document.connections : [];
  if (!Array.isArray(document.organizations)) errors.push("organizations must be an array.");
  if (!Array.isArray(document.careerItems) || careerItems.length < 1) errors.push("careerItems must contain at least one item.");
  if (!Array.isArray(document.resources)) errors.push("resources must be an array.");
  if (!Array.isArray(document.connections)) errors.push("connections must be an array.");

  const ids = new Set<string>();
  const register = (id: unknown, path: string) => {
    if (!checkId(id, path, errors)) return;
    if (ids.has(id)) errors.push(`${path} duplicates ID ${id}.`);
    ids.add(id);
  };
  for (const [index, organization] of organizations.entries()) {
    register(organization.id, `organizations[${index}].id`);
    checkLocalized(organization.name, localeList, `organizations[${index}].name`, errors);
    if (organization.url && !/^https:\/\//.test(organization.url)) errors.push(`organizations[${index}].url must use https.`);
  }
  const organizationIds = new Set(organizations.map((item) => item.id));
  const itemIds = new Set(careerItems.map((item) => item.id));
  const resourceIds = new Set(resources.map((item) => item.id));
  const graphIds = new Set([person?.id, ...organizationIds, ...itemIds, ...resourceIds]);
  for (const [index, item] of careerItems.entries()) {
    register(item.id, `careerItems[${index}].id`);
    if (!careerStates.has(item.state)) errors.push(`careerItems[${index}].state is unsupported.`);
    checkLocalized(item.title, localeList, `careerItems[${index}].title`, errors);
    checkLocalized(item.summary, localeList, `careerItems[${index}].summary`, errors);
    if (item.organizationId && !organizationIds.has(item.organizationId)) errors.push(`careerItems[${index}].organizationId is unknown.`);
    if (!Array.isArray(item.resourceIds)) errors.push(`careerItems[${index}].resourceIds must be an array.`);
    else for (const id of item.resourceIds) if (!resourceIds.has(id)) errors.push(`careerItems[${index}] references unknown resource ${id}.`);
    if (!Array.isArray(item.tags)) errors.push(`careerItems[${index}].tags must be an array.`);
    for (const [field, date] of [["startDate", item.startDate], ["endDate", item.endDate]] as const) if (date && !datePattern.test(date)) errors.push(`careerItems[${index}].${field} must be YYYY, YYYY-MM, or YYYY-MM-DD.`);
  }
  for (const [index, resource] of resources.entries()) {
    register(resource.id, `resources[${index}].id`);
    if (!resourceKinds.has(resource.kind)) errors.push(`resources[${index}].kind is unsupported.`);
    if (!resourceAvailabilities.has(resource.availability)) errors.push(`resources[${index}].availability is unsupported.`);
    checkLocalized(resource.label, localeList, `resources[${index}].label`, errors);
    if (!Array.isArray(resource.careerItemIds) || resource.careerItemIds.length < 1) errors.push(`resources[${index}].careerItemIds must not be empty.`);
    else for (const id of resource.careerItemIds) if (!itemIds.has(id)) errors.push(`resources[${index}] references unknown career item ${id}.`);
    if (resource.availability !== "public" && resource.url) errors.push(`resources[${index}] is not public and must not expose a URL.`);
    if (resource.kind === "nda-protected" && resource.url) errors.push(`resources[${index}] is NDA protected and must not expose a URL.`);
    if (resource.kind === "nda-protected" && resource.availability === "public") errors.push(`resources[${index}] is NDA protected and cannot be marked public.`);
    if (resource.availability === "public" && resource.kind !== "nda-protected" && !resource.url) errors.push(`resources[${index}] is public and requires a URL.`);
    if (resource.url && !/^https:\/\//.test(resource.url)) errors.push(`resources[${index}].url must use https.`);
    if (resource.provenance) {
      const source = resource.provenance;
      if (!provenanceTypes.has(source.recordType)) errors.push(`resources[${index}].provenance.recordType is unsupported.`);
      if (!provenanceStrengths.has(source.strength)) errors.push(`resources[${index}].provenance.strength is unsupported.`);
      if (!provenanceLifecycles.has(source.lifecycle)) errors.push(`resources[${index}].provenance.lifecycle is unsupported.`);
      if (!provenanceVisibilities.has(source.visibility)) errors.push(`resources[${index}].provenance.visibility is unsupported.`);
      if (!observedAtPattern.test(source.observedAt)) errors.push(`resources[${index}].provenance.observedAt must be YYYY-MM-DD.`);
      if (source.visibility !== "public" && source.sourceLabel) errors.push(`resources[${index}].provenance must not expose a non-public source label.`);
      if (source.visibility !== "public" && resource.url) errors.push(`resources[${index}] must not expose a non-public source URL.`);
      if (source.sourceLabel) checkLocalized(source.sourceLabel, localeList, `resources[${index}].provenance.sourceLabel`, errors);
    }
  }
  for (const [index, connection] of connections.entries()) {
    register(connection.id, `connections[${index}].id`);
    if (!connectionKinds.has(connection.kind)) errors.push(`connections[${index}].kind is unsupported.`);
    if (!graphIds.has(connection.sourceId) || !graphIds.has(connection.targetId)) errors.push(`connections[${index}] must connect known profile, organization, career item, or resource IDs.`);
    if (connection.sourceId === connection.targetId) errors.push(`connections[${index}] cannot connect an item to itself.`);
  }
  if (careerItems.length > 1 && connections.length === 0) warnings.push("Career graph has no explicit connections; recommendations will use deterministic fallback paths.");
  return { valid: errors.length === 0, errors, warnings };
}

export function assertValidProfile(value: unknown): asserts value is ResumilioProfile {
  const result = validateProfileDocument(value);
  if (!result.valid) throw new Error(result.errors.join("\n"));
}
