# Guided constellation avatar

This document defines the 0.8 design candidate that deliberately evolves the Phase 3 Evidence Constellation while preserving its validated profile, search, selection, recommendation, keyboard, bilingual, and responsive behavior.

Rendered reference captures:

- `guided-constellation-avatar-desktop.png` — 1440 × 1024 desktop candidate.
- `guided-constellation-avatar-mobile.png` — 390 × 844 mobile candidate.

## Experience model

- The public career map is a focused dark universe inside the otherwise white-first Resumilio experience.
- Daniel is the visual center of the map. Career highlights orbit the guide and connect back to him rather than forming a decorative or arbitrary chain.
- The detail rail and career list stay conventional and readable. The immersive treatment is limited to the map.
- Public language remains job-market language; internal profile and provenance contracts are unchanged.

## Reactions

The runtime uses only pre-rendered, first-party media:

- `daniel-idle.mp4`: quiet baseline loop.
- `daniel-waiting.mp4`: a one-shot shift after 24 seconds without another reaction.
- `daniel-nod.mp4`: acknowledgment when a visitor hovers, focuses, or selects a career highlight.
- `daniel-smile.mp4`: positive response to a search, filter, or “Show similar work” recommendation.

Motion begins on the visitor's first pointer, keyboard, or touch interaction. The waiting, nod, and smile clips play once and return to the standing-still idle. They are muted, inline, and have no dependency on Flow or any model at runtime. The idle poster remains visible before interaction, while video loads, or when motion is reduced.

## Accessibility and resilience

- The avatar is decorative; all meaning remains present in semantic controls and text.
- `prefers-reduced-motion` replaces moving video with the idle poster.
- Keyboard movement still selects and focuses the next visible highlight.
- Mobile turns the orbit into a dark connected career trail below a compact guide portrait.
- Failure to load or autoplay media does not block search, filtering, selection, recommendations, detail links, or static profile routes.

## Public asset boundary

Only the selected, optimized animations and their derived poster are published. Portrait references, generation scripts, provider records, and discarded iterations remain outside the repository and public build.
