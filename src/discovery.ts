import type { ResumilioProfile } from "./profile.js";

export type SignalKind = "search" | "open" | "filter" | "dwell" | "source-visit" | "more-like-this";
export type TopicVector = Record<string, number>;

export interface DiscoveryState {
  topics: TopicVector;
  openedClaimIds: string[];
  signalCount: number;
}

export interface SearchFilters {
  type?: string;
  lifecycle?: string;
  tag?: string;
  year?: string;
}

export const emptyDiscoveryState = (): DiscoveryState => ({ topics: {}, openedClaimIds: [], signalCount: 0 });

export function normalizeTerm(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function distanceAtMostOne(left: string, right: string): boolean {
  if (Math.abs(left.length - right.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) { i += 1; j += 1; continue; }
    edits += 1;
    if (edits > 1) return false;
    if (left.length > right.length) i += 1;
    else if (right.length > left.length) j += 1;
    else { i += 1; j += 1; }
  }
  return edits + Number(i < left.length || j < right.length) <= 1;
}

function tokenScore(query: string, candidate: string): number {
  if (candidate === query) return 12;
  if (candidate.startsWith(query)) return 8;
  if (candidate.includes(query)) return 5;
  if (query.length >= 4 && distanceAtMostOne(query, candidate)) return 3;
  return 0;
}

function claimText(claim: ResumilioProfile["claims"][number]): string[] {
  return [claim.title.en, claim.title.es, claim.summary.en, claim.summary.es, claim.type, claim.lifecycle, ...claim.tags]
    .flatMap((value) => normalizeTerm(value).split(" ")).filter(Boolean);
}

export function searchClaims(profile: ResumilioProfile, query: string, filters: SearchFilters = {}) {
  const terms = normalizeTerm(query).split(" ").filter(Boolean);
  return profile.claims
    .filter((claim) => !filters.type || claim.type === filters.type)
    .filter((claim) => !filters.lifecycle || claim.lifecycle === filters.lifecycle)
    .filter((claim) => !filters.tag || claim.tags.includes(filters.tag))
    .filter((claim) => !filters.year || profile.evidence.some((item) => claim.evidenceIds.includes(item.id) && item.observedAt.startsWith(filters.year!)))
    .map((claim) => {
      const tokens = claimText(claim);
      const score = terms.length ? terms.reduce((sum, term) => sum + Math.max(0, ...tokens.map((token) => tokenScore(term, token))), 0) : 1;
      return { claim, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.claim.id.localeCompare(b.claim.id));
}

const signalWeights: Record<SignalKind, number> = {
  search: 2,
  open: 3,
  filter: 2,
  dwell: 1,
  "source-visit": 4,
  "more-like-this": 5,
};

export function applySignal(state: DiscoveryState, kind: SignalKind, topics: string[], claimId?: string): DiscoveryState {
  const next: DiscoveryState = { topics: { ...state.topics }, openedClaimIds: [...state.openedClaimIds], signalCount: state.signalCount + 1 };
  for (const topic of [...new Set(topics.map(normalizeTerm).filter(Boolean))]) next.topics[topic] = (next.topics[topic] ?? 0) + signalWeights[kind];
  if (claimId && !next.openedClaimIds.includes(claimId)) next.openedClaimIds.push(claimId);
  return next;
}

export function recommendationScore(claim: ResumilioProfile["claims"][number], state: DiscoveryState): number {
  const topical = claim.tags.reduce((sum, tag) => sum + (state.topics[normalizeTerm(tag)] ?? 0), 0);
  const novelty = state.openedClaimIds.includes(claim.id) ? 0 : 1.5;
  return topical + novelty;
}

export function rankRecommendations(profile: ResumilioProfile, state: DiscoveryState, excludeClaimId?: string) {
  const remaining = profile.claims
    .filter((claim) => claim.id !== excludeClaimId)
    .map((claim) => ({ claim, score: recommendationScore(claim, state) }))
    .sort((a, b) => b.score - a.score || a.claim.id.localeCompare(b.claim.id));
  const selected: typeof remaining = [];
  const representedTags = new Set<string>();
  while (remaining.length) {
    remaining.sort((a, b) => {
      const adjusted = (item: typeof a) => item.score - item.claim.tags.filter((tag) => representedTags.has(tag)).length * .75;
      return adjusted(b) - adjusted(a) || a.claim.id.localeCompare(b.claim.id);
    });
    const next = remaining.shift()!;
    selected.push(next);
    next.claim.tags.forEach((tag) => representedTags.add(tag));
  }
  return selected;
}

function displayTopic(topic: string): string {
  const names: Record<string, string> = { hubspot: "HubSpot", openai: "OpenAI", sms: "SMS", "non ai": "non-AI" };
  return names[topic] ?? topic.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function recommendationReason(state: DiscoveryState, locale: "en" | "es"): string {
  const top = Object.entries(state.topics).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([topic]) => displayTopic(topic));
  if (!top.length) return locale === "es" ? "Recomendado desde el perfil público verificado" : "Recommended from the verified public profile";
  const joined = top.length === 1 ? top[0] : locale === "es" ? `${top[0]} y ${top[1]}` : `${top[0]} and ${top[1]}`;
  return locale === "es" ? `Recomendado porque exploraste ${joined}` : `Recommended because you explored ${joined}`;
}
