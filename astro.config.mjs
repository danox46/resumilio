import { defineConfig } from "astro/config";
import react from "@astrojs/react";

export default defineConfig({
  integrations: [react()],
  site: process.env.PUBLIC_SITE_ORIGIN ?? "https://resumilio.danienremoto.com",
  output: "static",
  outDir: "./site-dist",
  devToolbar: { enabled: false },
  trailingSlash: "always",
  build: { assets: "assets" },
});
