import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";
import type { ResumilioConfig, ResumilioProfile } from "../core/profile.js";
import { Constellation } from "../ui/Constellation.js";

const profile = JSON.parse(await readFile("profiles/demo.json", "utf8")) as ResumilioProfile;
const config = JSON.parse(await readFile("resumilio.config.json", "utf8")) as ResumilioConfig;

test("constellation applies all configured palette tokens", () => {
  const customized = structuredClone(config);
  customized.presentation.palette = {
    background: "#101820",
    text: "#faf8f2",
    accent: "#e5a600",
    muted: "#969b94",
  };
  const html = renderToStaticMarkup(createElement(Constellation, { profile, config: customized }));
  for (const token of Object.values(customized.presentation.palette)) assert.ok(html.includes(token), `Missing palette token ${token}`);
});
