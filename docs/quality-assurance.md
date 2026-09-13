# Quality assurance

Resumilio's public experience is verified against a fixed quality contract before publication.

## Automated gates

- Seven target viewports: 240×240, 320×568, 390×844, 768×1024, 1440×1024, 1920×1080, and 3840×2160.
- Lighthouse mobile scores of at least 95 for performance, accessibility, best practices, and SEO.
- Largest Contentful Paint below 2.5 seconds and Cumulative Layout Shift below 0.1.
- Directional-key, Home, End, Enter, Space, Tab, and visible-focus behavior.
- Reduced-motion support, semantic text alternatives, and touch targets.
- No model calls, analytics, behavioral telemetry, cookies, local storage, or runtime fetches. Personalization stays in `sessionStorage`.
- Evidence detail pages remain static and do not load the interactive graph bundle.

## Manual gate

The release candidate is reviewed at every target viewport. A keyboard and screen-reader smoke test confirms navigation order, control names, live detail announcements, bilingual labels, and evidence-link destinations. Browser network inspection must show only first-party static document and asset requests.
