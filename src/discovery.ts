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
  const profileOrder = new Map(profile.claims.map((claim, index) => [claim.id, index]));
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
    .sort((a, b) => b.score - a.score || (profileOrder.get(a.claim.id) ?? 999) - (profileOrder.get(b.claim.id) ?? 999));
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

const directRelationshipBoost = 8;

export function rankRecommendations(profile: ResumilioProfile, state: DiscoveryState, excludeClaimId?: string) {
  // Profile order is a small editorial freshness signal; direct relationships and demonstrated intent can override it.
  const profileOrder = new Map(profile.claims.map((claim, index) => [claim.id, index]));
  const lastProfileIndex = Math.max(profile.claims.length - 1, 1);
  const curationBias = (claimId: string) => {
    const index = profileOrder.get(claimId) ?? lastProfileIndex;
    return 1.2 * (1 - index / lastProfileIndex);
  };
  const relatedClaimIds = new Set(profile.relationships.flatMap((relationship) => {
    if (relationship.type !== "related-to" || !excludeClaimId) return [];
    if (relationship.sourceId === excludeClaimId) return [relationship.targetId];
    if (relationship.targetId === excludeClaimId) return [relationship.sourceId];
    return [];
  }));
  const remaining = profile.claims
    .filter((claim) => claim.id !== excludeClaimId)
    .map((claim) => ({
      claim,
      directlyRelated: relatedClaimIds.has(claim.id),
      score: recommendationScore(claim, state) + curationBias(claim.id) + (relatedClaimIds.has(claim.id) ? directRelationshipBoost : 0),
    }))
    .sort((a, b) => Number(b.directlyRelated) - Number(a.directlyRelated) || b.score - a.score || a.claim.id.localeCompare(b.claim.id));
  const selected: typeof remaining = [];
  const representedTags = new Set<string>();
  while (remaining.length) {
    remaining.sort((a, b) => {
      if (a.directlyRelated !== b.directlyRelated) return Number(b.directlyRelated) - Number(a.directlyRelated);
      const adjusted = (item: typeof a) => item.score - item.claim.tags.filter((tag) => representedTags.has(tag)).length * .75;
      return adjusted(b) - adjusted(a) || a.claim.id.localeCompare(b.claim.id);
    });
    const next = remaining.shift()!;
    selected.push(next);
    next.claim.tags.forEach((tag) => representedTags.add(tag));
  }
  return selected.map(({ directlyRelated: _, ...recommendation }) => recommendation);
}

export function traversalSuccessorId(profile: ResumilioProfile, claimId: string): string | undefined {
  if (profile.claims.length < 2) return undefined;
  const currentIndex = profile.claims.findIndex((claim) => claim.id === claimId);
  if (currentIndex < 0) return profile.claims[0]?.id;
  return profile.claims[(currentIndex + 1) % profile.claims.length]?.id;
}

export function rankConstellationRecommendations(
  profile: ResumilioProfile,
  state: DiscoveryState,
  centerClaimId: string,
  limit = 5,
) {
  if (limit <= 0) return [];
  const ranked = rankRecommendations(profile, state, centerClaimId);
  const selected = ranked.slice(0, limit);
  const protectedIds = new Set<string>();

  const include = (candidate: typeof ranked[number] | undefined, protect = false) => {
    if (!candidate) return;
    if (selected.some((item) => item.claim.id === candidate.claim.id)) {
      if (protect) protectedIds.add(candidate.claim.id);
      return;
    }
    if (selected.length < limit) selected.push(candidate);
    else {
      let replacementIndex = -1;
      for (let index = selected.length - 1; index >= 0; index -= 1) {
        if (!protectedIds.has(selected[index].claim.id)) { replacementIndex = index; break; }
      }
      if (replacementIndex < 0) return;
      selected[replacementIndex] = candidate;
    }
    if (protect) protectedIds.add(candidate.claim.id);
  };

  // Every claim points to the next stable profile record. Following this one bridge
  // from any center walks the entire graph and prevents disconnected recommendation islands.
  const traversalId = traversalSuccessorId(profile, centerClaimId);
  include(ranked.find((item) => item.claim.id === traversalId), true);

  // Relevance may fill all five slots with records the visitor already opened. Keep
  // one genuinely unexplored frontier available until the whole graph has been seen.
  const openedIds = new Set(state.openedClaimIds);
  const frontier = ranked.find((item) => !openedIds.has(item.claim.id));
  include(frontier);

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
