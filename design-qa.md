# Mobile constellation space-usage QA

- Source visual truth: `docs/design/mobile-space-usage-feedback.png`
- Implementation screenshot: `docs/design/mobile-space-usage-implementation.png`
- Combined comparison: `docs/design/mobile-space-usage-comparison.png`
- Implementation viewport: 390 x 844 CSS pixels at device scale factor 1
- Source pixels: 384 x 786; normalized to 390 x 844 for the comparison board
- Implementation pixels: 390 x 844
- State: English default selection, reduced motion, idle avatar poster

## Full-view comparison evidence

The normalized annotated source and revised implementation were inspected together in one 780 x 844 comparison. The implementation preserves the graphite-and-amber atmosphere and the face-safe background avatar, while correcting the three issues marked by the user: the focused record now owns substantially more area, the portrait is slightly reduced, and the active path visibly changes direction across a right-left-right node sequence. The denser connected background field also fills the previously empty upper-right and lower-right regions without becoming interactive noise.

## Focused region evidence

- Focus panel: the revised surface is wider and taller, carries a larger title, preserves organization and focused lifecycle state, and allows a three-line summary. It is now the strongest information object rather than a small overlay.
- Avatar and face: the portrait is scaled to 90% and shifted slightly left/up. The face remains unobstructed at 390 x 844 and 320 x 568 while the card occupies the torso.
- Active constellation: three title-only circles alternate from upper-right to left-middle to lower-right. One straight-segment SVG polyline connects the sequence and includes illuminated joints; it is decorative and does not alter graph semantics.
- Controls: the bottom dock remains fully visible and separate from the animated focus panel at both tested phone sizes.

## Required fidelity surfaces

- Fonts and typography: the existing Inter/system stack remains consistent with the product. The focus title is now 24-32px on mobile with tighter display leading; supporting text remains readable and clamped without overflow.
- Spacing and layout rhythm: the card grows from a narrow torso overlay to the primary 77%-wide information region. The smaller portrait creates breathing room, while the zig-zag nodes use the upper-right, left-middle, and lower-right bands instead of a single diagonal.
- Colors and visual tokens: existing graphite, amber, ivory, and muted gray tokens are preserved. Active mobile connectors and reserve edges are strengthened modestly to make the constellation legible.
- Image quality and asset fidelity: the approved first-party avatar video and poster remain unchanged. Only CSS scale, anchor, and masking composition changed; no generated likeness replaced the real asset.
- Copy and content: approved labels remain `Classic View` and `Similar Work`; preview nodes remain title-only, and lifecycle state remains exclusive to the focused record.

## Comparison history

1. Earlier hybrid implementation: P1 bottom action overlap.
   - Fix: mobile actions were moved outside the animated focus component into a fixed bottom dock.
   - Post-fix evidence: the dock is collision-free in the final 390 x 844 and 320 x 568 captures.
2. Earlier hybrid implementation: P2 oversized portrait and undersized focused record.
   - Fix: reduced the avatar to 90%, widened the focus region, increased its minimum height and padding, enlarged its typography, and exposed one additional summary line.
   - Post-fix evidence: `mobile-space-usage-comparison.png` shows the record as the dominant interactive object while the face remains clear.
3. Earlier hybrid implementation: P2 active nodes read as a nearly straight diagonal and the empty right-side regions weakened the constellation theme.
   - Fix: repositioned the three mobile nodes into a right-left-right sequence, added a connected straight-segment polyline with luminous joints, and raised the quiet reserve-field contrast.
   - Post-fix evidence: the final comparison and implementation capture show deliberate direction changes across the full viewport.

## Browser verification

- Primary interactions: node selection, three-node keyboard loop, search expansion and submission, Similar Work, Classic View new-tab behavior, reset, language switching, queued selection, and responsive avatar handoff.
- Responsive captures: 240 x 240, 320 x 568, 390 x 844, 768 x 1024, 1440 x 1024, 1920 x 1080, 2572 x 1233, and 3840 x 2160.
- Console and page errors: none.
- Horizontal overflow and node-label overflow: none.
- External runtime requests: none.
- Remaining P3: very long preview titles still truncate to two lines; the full title remains available to assistive technology and through the element title.

final result: passed
