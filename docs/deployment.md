# Cloudflare deployment

The flagship site is an assets-only Cloudflare Worker named `resumilio`. Its only public production origin is `https://resumilio.danienremoto.com`. Wrangler declares that hostname as a Cloudflare Custom Domain and disables the public `workers.dev` route. Cloudflare manages the DNS record and certificate from the checked-in configuration.

## Release sequence

1. Run `npm run phase6`, `npm run verify:browser-quality`, `npm pack --dry-run`, and `git diff --check`.
2. Run `npm run dev:cloudflare`, then `npm run verify:deployment -- <local-origin>`.
3. Run `npm run deploy:preview`. Verify the returned version URL and compare it with the local origin using `npm run verify:deployment -- <local-origin> <preview-origin>`.
4. Confirm the custom hostname is free of conflicting DNS records, record the current production Worker version as the rollback target, and require green CI on the exact `main` commit.
5. At the release gate, promote the verified Worker version. Verify TLS, redirects, HTML and data routes, security/cache headers, localized metadata, and the Cloudflare deployment readback at the custom domain.
6. If live verification fails, immediately roll back to the recorded Worker version and postpone the GitHub release.

Static assets are served directly. There is no Worker application code, runtime model call, analytics request, database, or behavioral backend.
