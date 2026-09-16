# Mobile constellation design QA

- Source visual truth: `docs/design/mobile-constellation-hybrid.png`
- Implementation screenshot: `docs/design/mobile-constellation-hybrid-implementation.png`
- Combined comparison: `docs/design/mobile-constellation-hybrid-comparison.png`
- Viewport: 390 x 844 CSS pixels at device scale factor 1
- Source pixels: 853 x 1844, normalized to 390 x 844 for comparison
- Implementation pixels: 390 x 844
- State: English default selection, reduced motion, idle avatar poster

## Full-view comparison evidence

The normalized source and implementation were inspected together in one 780 x 844 comparison. Both use one full-height graphite stage, a persistent left-anchored portrait, a clear face region, a compact torso record, three active circular paths, faint reserved graph depth, and a bottom thumb dock. The implementation intentionally removes the source's `NOW EXPLORING` label, removes lifecycle state from preview nodes, and uses the approved `Classic View` and `Similar Work` labels.

## Focused region evidence

- Face and torso: the final 390 x 844 and 320 x 568 captures keep the face unobstructed. The information surface begins below the chin and remains over the torso.
- Focus panel: title, organization, focused lifecycle state, and two-line summary remain within the bordered surface for ordinary and long-title states.
- Controls: the action dock and search control remain independent from the animated focus panel, fully visible above the bottom safe area, and do not overlap copy.
- Nodes: mobile renders three active text-only nodes with no lifecycle subtitles; desktop and tablet retain five. No visible label crosses a node boundary.

## Required fidelity surfaces

- Fonts and typography: the implementation uses the existing Inter/system stack with matching heavy display titles, compact labels, balanced wrapping, and clamped long titles. The generated source's wider display weight is approximated with the existing public font contract rather than introducing a new dependency.
- Spacing and layout rhythm: the final stage uses the full viewport. Header, face-safe region, torso panel, diagonal node trail, and bottom controls occupy separate spatial bands at 390 x 844 and 320 x 568.
- Colors and visual tokens: graphite, warm amber, ivory, muted warm gray, translucent black, and the existing line opacities match the selected direction.
- Image quality and asset fidelity: the implementation uses the approved first-party avatar video and poster rather than the generated approximation. Its softer source resolution is accepted because it preserves Daniel's actual likeness and animation set.
- Copy and content: visible narration is removed. Focused records alone show lifecycle state. Preview nodes show only titles. CTAs are `Classic View` and `Similar Work`, with localized Spanish equivalents.

## Comparison history

1. Initial implementation: P1 action dock overlap. The animated focus surface established a containing block, causing both CTAs to cover the record copy on mobile.
   - Fix: moved mobile actions outside the animated focus component and made the dock a graph-stage sibling.
   - Post-fix evidence: `390x844-mobile.png` and `320x568-small-mobile.png` show the dock fixed at the bottom with no copy collision.
2. Initial implementation: P2 face-space inefficiency. The avatar began too low and left a large unused band above the head.
   - Fix: anchored the mobile avatar at the top of the viewport, expanded it to the bottom control boundary, and moved the focus panel below the raised face.
   - Post-fix evidence: the final combined comparison shows closer source proportions and a clear, unobstructed face on tall and short phones.
3. Initial implementation: P2 leftover chevron affordances on preview nodes.
   - Fix: disabled the legacy mobile node pseudo-element in the immersive experience.
   - Post-fix evidence: final mobile captures use clean title-only circles.

## Browser verification

- Primary interactions: node selection, three-node keyboard loop, search expansion and submission, Similar Work, Classic View new-tab behavior, reset, language switching, queued selection, and responsive avatar clip handoff.
- Responsive captures: 240 x 240, 320 x 568, 390 x 844, 768 x 1024, 1440 x 1024, 1920 x 1080, 2572 x 1233, and 3840 x 2160.
- Console and page errors: none.
- External runtime requests: none.
- Remaining P3: very long mobile node titles are deliberately truncated to two lines; the full title remains available to assistive technology and as the element title.

final result: passed
