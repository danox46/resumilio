# Guided constellation avatar

This document defines the 0.8 design candidate that deliberately evolves the Phase 3 Evidence Constellation while preserving its validated profile, search, selection, recommendation, keyboard, bilingual, and responsive behavior.

Rendered reference captures:

- `guided-constellation-avatar-desktop.png` — 1440 × 1024 desktop candidate.
- `guided-constellation-avatar-mobile.png` — 390 × 844 mobile candidate.

## Experience model

- The public career map is a focused dark universe inside the otherwise white-first Resumilio experience.
- Career information is the visual center. On wide layouts, Daniel occupies the lower-left corner as a supporting guide while the career-map hub, highlights, and selected detail own the center and right side.
- On stacked layouts, the portrait returns to the horizontal center because the selected information moves below it; at phone widths the short selected-title callout sits over the lower portrait.
- The detail rail and career list stay conventional and readable. The immersive treatment is limited to the map.
- Public language remains job-market language; internal profile and provenance contracts are unchanged.

## Reactions

The runtime uses only pre-rendered, first-party media:

- `daniel-idle.mp4`: quiet baseline loop.
- `daniel-waiting.mp4`: a one-shot shift after 24 seconds without another reaction.
- `daniel-nod.mp4`: acknowledgment when a visitor hovers, focuses, or selects a career highlight.
- `daniel-guide-wide.mp4`: wide-layout selection guidance; Daniel gestures toward the detail rail.
- `daniel-guide-stacked.mp4`: stacked-layout selection guidance; Daniel looks toward the selected information below him.
- `daniel-smile.mp4`: positive response to a search, filter, or “Show similar work” recommendation.

The standing-still idle video loads and plays immediately. The waiting, nod, guidance, and smile clips play once and return to that idle. They are muted, inline, and have no dependency on Flow or any model at runtime. The idle poster remains visible only while video loads, if playback fails, or when motion is reduced.

## Responsive reaction contract

`selection-guidance` is one semantic event with layout-aware choreography. It fires when a visitor selects a career highlight, including directional-key selection. The event always updates the same selected claim and accessible detail content; only its decorative animation changes:

- `wide` at 821px and above uses `daniel-guide-wide.mp4`, because the selected detail is in the rail to Daniel's right.
- `stacked` at 820px and below uses `daniel-guide-stacked.mp4`, because the selected detail is below the portrait. At phone widths, a short, decorative selected-title callout sits over the lower portrait to give the downward gaze an immediate visual target; the complete semantic detail remains in the career trail.

The breakpoint is owned by the representation, not by device detection. It matches the CSS transition where `.constellation` changes from a side-by-side grid to a stacked layout. `matchMedia("(max-width: 820px)")` is observed at runtime, so resizing or rotating before another selection changes the next guidance clip without changing the event name or selected record.

Wide composition deliberately avoids making the avatar the graph hub: the portrait is anchored at `left: 13%` and below the visual midpoint, its orbit rings are suppressed, and relationship lines originate from the information field at 62%. The stacked representation restores the centered portrait, original node coordinates, and orbit treatment. Agents reproducing this pattern should bind avatar placement and choreography to the same representation breakpoint so pose and information hierarchy cannot drift apart.

To add another responsive reaction, keep one semantic reaction name, provide an asset per layout only when the choreography must change, and select the asset through the same `AvatarLayout` mapping. Do not fork analytics or business behavior by viewport.

### Media preparation

Source clips are normalized to silent, fast-start H.264 at 720 × 1280, 24fps, `yuv420p`:

```powershell
ffmpeg -i <source.mp4> -map_metadata -1 -an -vf "scale=720:1280:flags=lanczos" -c:v libx264 -preset slow -crf 24 -pix_fmt yuv420p -r 24 -movflags +faststart <public-output.mp4>
```

Verify each result with `ffprobe`, then run `npm run phase6`. Browser QA must select a different career highlight once at 1440px and once at 390px and confirm that both runs expose `data-avatar-state="guide"` while the chosen sources and `data-avatar-variant` differ.

## Accessibility and resilience

- The avatar is decorative; all meaning remains present in semantic controls and text.
- `prefers-reduced-motion` replaces moving video with the idle poster.
- Keyboard movement still selects and focuses the next visible highlight.
- Mobile turns the orbit into a dark connected career trail below a compact guide portrait.
- Failure to load or autoplay media does not block search, filtering, selection, recommendations, detail links, or static profile routes.

## Public asset boundary

Only the selected, optimized animations and their derived poster are published. Portrait references, generation scripts, provider records, and discarded iterations remain outside the repository and public build.
