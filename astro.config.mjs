import { defineConfig } from "astro/config";
import react from "@astrojs/react";

const publicBasePath = `/${String(process.env.PUBLIC_BASE_PATH ?? "").replace(/^\/+|\/+$/g, "")}`.replace(/^\/$/, "");

export default defineConfig({
  integrations: [react()],
  site: process.env.PUBLIC_SITE_ORIGIN ?? "https://resumilio.danielx9.workers.dev",
  base: publicBasePath || "/",
  output: "static",
  outDir: "./site-dist",
  devToolbar: { enabled: false },
  trailingSlash: "always",
  build: { assets: "assets" },
});
