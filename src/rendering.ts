import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Locale, ResumilioProfile } from "./profile.js";
import { writeJson } from "./workspace.js";

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

export function renderMarkdown(profile: ResumilioProfile, locale: Locale): string {
  const person = profile.profile;
  const lines = [`# ${person.name[locale]}`, "", person.headline[locale], "", person.summary[locale], "", "## Work", ""];
  for (const claim of profile.claims) {
    lines.push(`### ${claim.title[locale]}`, "", claim.summary[locale], "", `Status: ${claim.lifecycle}`, "");
  }
  lines.push("## Contact", "");
  for (const contact of person.contacts) lines.push(`- [${contact.label[locale]}](${contact.url})`);
  return `${lines.join("\n")}\n`;
}

export function renderHtml(profile: ResumilioProfile, locale: Locale): string {
  const person = profile.profile;
  const claims = profile.claims.map((claim) => `<article><h2>${escapeHtml(claim.title[locale])}</h2><p>${escapeHtml(claim.summary[locale])}</p><small>${escapeHtml(claim.lifecycle)}</small></article>`).join("\n");
  const contacts = person.contacts.map((contact) => `<a href="${escapeHtml(contact.url)}">${escapeHtml(contact.label[locale])}</a>`).join(" · ");
  return `<!doctype html>
<html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(person.name[locale])}</title>
<style>:root{color-scheme:light;font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#18201d;background:#fff}body{margin:0}main{max-width:760px;margin:auto;padding:64px 24px 96px}h1{font-size:clamp(2.5rem,8vw,5rem);letter-spacing:-.06em;line-height:.95;margin:0 0 24px}header>p{font-size:1.2rem;line-height:1.6;max-width:640px}section{margin-top:64px}article{padding:28px 0;border-top:1px solid #dfe5e1}h2{font-size:1.5rem;margin:0 0 10px}p{line-height:1.65}small{color:#52605a;text-transform:capitalize}footer{margin-top:64px;padding-top:24px;border-top:1px solid #dfe5e1}a{color:#176b4c;text-underline-offset:3px}</style></head>
<body><main><header><h1>${escapeHtml(person.name[locale])}</h1><p><strong>${escapeHtml(person.headline[locale])}</strong></p><p>${escapeHtml(person.summary[locale])}</p></header><section>${claims}</section><footer>${contacts}</footer></main></body></html>\n`;
}

export async function buildPreview(profile: ResumilioProfile, outputDirectory: string, locale: Locale): Promise<string> {
  const target = resolve(outputDirectory);
  await mkdir(target, { recursive: true });
  const output = resolve(target, "index.html");
  await writeFile(output, renderHtml(profile, locale), "utf8");
  return output;
}

export function sanitizedDeploymentProfile(profile: ResumilioProfile): ResumilioProfile {
  return structuredClone(profile);
}

export async function buildDeploymentArtifacts(profile: ResumilioProfile, outputDirectory: string, locale: Locale): Promise<{ index: string; profile: string }> {
  const target = resolve(outputDirectory);
  const publicProfile = sanitizedDeploymentProfile(profile);
  const index = await buildPreview(publicProfile, target, locale);
  const profilePath = resolve(target, "profile.json");
  await writeJson(profilePath, publicProfile);
  return { index, profile: profilePath };
}
