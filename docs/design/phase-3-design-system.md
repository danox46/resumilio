# Phase 3 design system

The accepted concept is the corrected Evidence Constellation pair:

- `evidence-constellation-desktop.png` — 1536 × 1024 desktop source of truth.
- `evidence-constellation-mobile.png` — 1024 × 1536 mobile transformation source of truth.

## Visual point of view

The constellation is a precise information graph on true white, not ornamental space imagery. Daniel remains the visual identity. Resumilio appears once as restrained attribution. The interface uses an open canvas, a slim detail rail, and a conventional evidence list—never a card grid or marketing wrapper.

## Tokens

- Background: true white `#ffffff`.
- Ink: deep navy `#071a3b`.
- Body/muted: slate `#536681`.
- Primary: forest `#087a4b`.
- Secondary node: leaf `#66b57a`.
- Focus/selection: coral `#ff6b57`.
- Evidence node: mist blue `#adbac9`.
- Lines and borders: `#d8e1ea` and `#bdcad8`.
- Typography: Inter-like system sans (`Inter`, `ui-sans-serif`, `system-ui`) with deliberate control sizes; no browser-default control type.
- Content width: fluid up to 1536px with 36px desktop gutters and 20px mobile gutters.
- Motion: 160–220ms state changes and gentle branch reveal; disabled for reduced motion.

## Allowed visible copy

Above the fold is limited to the person name, approved headline, “Explore the evidence behind the work.”, Evidence, Graph, Search, EN / ES, Reset this session, the search placeholder, factual filters, and copy derived verbatim from the validated profile. No eyebrow, badge, metric, testimonial, marketing claim, or invented evidence label may be added.

## Component families

- Quiet header: name, three anchor links, locale switch, reset.
- Search/filter bar: search, type, lifecycle, tag, and clear action; mobile collapses filters to one select/disclosure.
- Constellation canvas: claim buttons, evidence nodes, semantic relationship lines, selected coral ring, keyboard focus.
- Detail rail / inline disclosure: exact title, summary, lifecycle, evidence strength, visibility, recommendation reason, View evidence, More like this.
- Evidence list: open rows on desktop and simple disclosure links on mobile.
- Footer: Powered by Resumilio plus locale switch.

## Responsive transformation

- 1440px and above: open constellation and detail rail share one bordered plane.
- 1024px: preserve the graph/detail split with reduced node spread.
- 768px: detail moves below the graph while the evidence list remains tabular.
- 390px and 320px: graph becomes a vertical connected evidence trail; selected detail expands inline; table becomes a title list.
- 240px: single-column watch layout, abbreviated navigation, one full-width action at a time, no horizontal overflow.
- 3840px: cap reading width while enlarging the graph plane and whitespace rather than scaling text without limit.

## Icon inventory

- Search: 2px outline magnifier, 20px desktop / 22px touch.
- Reset: 2px counter-clockwise circular arrow.
- Menu: three 2px horizontal strokes.
- Disclosure: 2px chevron, rotates on expansion.
- Row navigation: 2px right chevron.

All icons are inline SVG using `currentColor`, optically centered, and paired with accessible names or hidden when adjacent text already names the action.
