import { defineConfig } from "astro/config";
import react from "@astrojs/react";

export default defineConfig({
  integrations: [react()],
  site: process.env.PUBLIC_SITE_ORIGIN ?? "https://resumilio.danielx9.workers.dev",
  output: "static",
  outDir: "./site-dist",
  devToolbar: { enabled: false },
  trailingSlash: "always",
  build: { assets: "assets" },
});
