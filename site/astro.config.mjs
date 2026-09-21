import { defineConfig } from "astro/config";
import react from "@astrojs/react";

export default defineConfig({
  site: process.env.PUBLIC_SITE_ORIGIN ?? "https://resumilio.danienremoto.com",
  output: "static",
  integrations: [react()],
});
