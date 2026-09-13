# Cloudflare deployment

The flagship site is an assets-only Cloudflare Worker named `resumilio`. The public origin is `https://resumilio.danielx9.workers.dev`; no custom domain or DNS change is part of v1.

The release sequence is:

1. Run `npm run phase6`.
2. Run `npm run dev:cloudflare` and verify the local Wrangler URL with `npm run verify:deployment -- <origin>`.
3. Upload a preview version with `npm run deploy:preview` and verify the returned preview URL against the local URL.
4. Publish with `npm run deploy:public`.
5. Verify the public URL independently and read back the Worker version through Cloudflare.

Static assets are served directly. There is no Worker application code, runtime model call, analytics request, database, or behavioral backend.
