# Reactive constellation avatar

This document defines the immersive Resumilio candidate that replaces the mixed constellation-and-classic landing page. The previous implementation remains recoverable at the annotated Git tag `archive/constellation-reference-2026-09-15`.

Rendered design references:

- `immersive-constellation-concept-desktop.png`
- `immersive-constellation-concept-mobile.png`

The concepts establish hierarchy and mood. The implementation deliberately uses circular nodes, ordinary straight SVG lines, semantic HTML controls, and React state rather than reproducing ornamental details from generated imagery.

## Experience model

The landing page is one constellation of experience. It has no classic resume list, table, sidebar, full filter bank, or repeated metadata panel. Classic record pages remain available through **View experience**.

The constellation is reactive rather than exhaustive:

1. One career record owns the focused detail card.
2. At most five related records appear as circular nodes.
3. Selecting a node first enlarges that populated node while the other populated nodes recede, then makes it the focus and rebuilds the visible neighborhood from its topics plus the visitor's session signals.
4. Search temporarily replaces the neighborhood with the strongest matching records and promotes the first result when submitted.
5. **Show similar work** increases the selected topics' weight and advances to the strongest novel recommendation.

All profile records remain discoverable through repeated selection and search, but they are never rendered together as visual noise. The status line states the visible and total counts so progressive disclosure is explicit rather than mysterious.

The visual reservoir and the record model are deliberately separate. Seven fixed ambient circles provide depth and gently expand during a transition, but they never own IDs, text, links, or empty record slots. The five active slots are the only populated controls. React replaces their records after selection, so a quiet ambient circle can appear to become part of the new constellation without encoding a fake record or pre-rendering every possible node.

Personalization is deterministic and session-local. There is no model call, tracking request, cookie, account, or server-side visitor profile.

## Composition

- The selected experience is the visual center.
- On wide layouts, Daniel is anchored in the lower-left as a supporting presence. He is never the graph hub.
- On layouts at 700px and below, Daniel is centered above the selected detail and the selected title appears on his chest during the visual sequence. The 701-1100px composition keeps all five active nodes visible around the circular focus.
- Circular nodes are intentionally simple CSS buttons. Their straight connectors are one inline SVG on wide screens and short CSS line segments in the stacked representation.
- The neutral background follows the source video rather than introducing a separate blue universe: roughly `#202121` at the top, `#151616` through the middle, and `#080909` at the base.
- A large graphite circle sits behind the unchanged lower-left video position. Its warmer center follows the portrait background while a four-edge plus elliptical mask dissolves the media rectangle into it. The thin amber outline connects it to the active node language without turning the avatar into the graph hub. The video remains first-party and plays directly; the poster is the reduced-motion and playback-failure fallback.

## Avatar reactions

The runtime uses only the approved local media:

- `daniel-idle.mp4`: quiet baseline loop, autoplayed immediately.
- `daniel-waiting.mp4`: one-shot shift after 24 seconds at idle.
- `daniel-nod.mp4`: acknowledgement when an idle avatar receives node focus or hover.
- `daniel-guide-wide.mp4`: selection on wide screens; Daniel points toward the information field.
- `daniel-guide-stacked.mp4`: the same selection event on small screens; Daniel looks toward the chest callout and detail below.
- `daniel-smile.mp4`: positive response to search and **Show similar work**.

Hover/focus acknowledgement is allowed only while the avatar is idle. This prevents a newly rendered node under the pointer from interrupting the more important selection-guidance clip when the neighborhood reforms.

## Responsive event contract

`selection-guidance` is one semantic event with two visual representations. `matchMedia("(max-width: 700px)")` selects the video asset at the same breakpoint where the information layout changes. The selected record, session signal, destination link, and accessible announcement are identical in both representations.

The interactive island hydrates on page load because direct node selection and immediate avatar playback are the page's primary experience, not a deferred enhancement. On ordinary motion settings, the outgoing phase lasts 240ms and the incoming focus and neighborhood settle by 760ms. Reduced-motion visitors receive the same record change immediately, without the transition choreography.

Agents extending the system should keep event meaning independent from the viewport. Add a layout-specific clip only when choreography must change, then bind it to the representation breakpoint rather than device detection.

## Accessibility and resilience

- The avatar is decorative. The selected record and every suggestion remain semantic text and controls.
- Arrow keys, Home, and End move focus within the currently visible neighborhood; Enter or Space selects through native button behavior.
- Focus remains visible, the changing detail is announced politely, and the neighborhood has an accessible group label and instruction.
- `prefers-reduced-motion` hides moving video and retains the poster.
- A missing video never blocks search, selection, recommendations, or classic record routes.
- Browser QA covers 240px, 320px, 390px, 768px, 1440px, 1920px, and 3840px without horizontal overflow.

## Media preparation

Source clips are normalized to silent, fast-start H.264 at 720 x 1280, 24fps, `yuv420p`:

```powershell
ffmpeg -i <source.mp4> -map_metadata -1 -an -vf "scale=720:1280:flags=lanczos" -c:v libx264 -preset slow -crf 24 -pix_fmt yuv420p -r 24 -movflags +faststart <public-output.mp4>
```

Only the selected animations and derived poster are public. Portrait references, provider sessions, generation records, source downloads, and discarded iterations stay outside the repository and public build.
