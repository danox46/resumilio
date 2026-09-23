# Your Resumilio project

This project starts with a **fictional profile**. Replace it with your own career information before publishing. You can edit it without an agent or account.

## Edit the profile

Open `resumilio.json` and work through these sections in order:

1. `profile`: set your name, headline, summary, and public contact links. `defaultLocale` must be included in `locales`.
2. `organizations`: add the employers, clients, schools, or publishers you want to name publicly. Give each a stable `id`.
3. `careerItems`: add roles, projects, education, certifications, publications, and skills. Each item needs a stable `id`, localized `title` and `summary`, a truthful `state`, `resourceIds`, and `tags`. Add dates or an `organizationId` only when known and appropriate to share.
4. `resources`: connect public demos, previews, repositories, certificates, or work samples to items through both `careerItemIds` and `resourceIds`. A `public` resource needs a public URL. An `nda-protected` resource must **not** have a URL; describe only what you are permitted to disclose.
5. `connections`: link related career items using their stable IDs. Every item should have a path to the rest of the graph, so visitors can reach more than one cluster.

For another language, add its locale code to `profile.locales` and translate every localized name, title, summary, contact label, and resource label. If you want one language only, remove the extra locale from the list and localized fields. Routes are generated from the configured locales.

Keep private files, customer details, credentials, and internal source locations outside this public project. Resumilio links to public work; it does not host your private documents.

## Validate and preview

```bash
npx resumilio validate resumilio.json
npm run check
npm run dev
```

The validator reports missing fields and broken item/resource references, plus graph connectivity in its health result. Review disconnected clusters before `npm run build`; the build writes a static `dist/` folder. The classic resume at `/classic/` is the no-agent, print-friendly fallback.

## Presentation settings

`resumilio.config.json` points to `resumilio.json`. Its companion toggle, palette colors, and mobile/desktop active-node counts control the constellation. You can disable the cat without changing recommendations. To replace its artwork now, replace the matching files in `public/images/`; `variant: "custom"` and `customMedia` are reserved for a future responsive-media interface and do not yet select alternate files.

The local authoring skill in `.resumilio/skills/` is optional. External publication is your choice; preview and build commands do not publish your site.
