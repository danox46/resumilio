import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import sharp from "sharp";

const poses = ["idle", "blink", "smile", "guide-wide", "guide-mobile"] as const;
const expectedSize = 1024;

async function inspect(path: string) {
  const { data, info } = await sharp(path)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (info.width !== expectedSize || info.height !== expectedSize || info.channels !== 4) {
    throw new Error(`${path} must be a ${expectedSize}x${expectedSize} RGBA PNG.`);
  }

  let visible = 0;
  let transparent = 0;
  let baseline = -1;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const alpha = data[(y * info.width + x) * info.channels + 3];
      if (alpha > 24) {
        visible += 1;
        baseline = y;
      } else {
        transparent += 1;
      }
    }
  }

  const pixels = info.width * info.height;
  if (visible / pixels < 0.2 || transparent / pixels < 0.2) {
    throw new Error(`${path} must contain a substantial transparent margin and a visible full-body character.`);
  }
  if (baseline < 900 || baseline > 1005) {
    throw new Error(`${path} has an unexpected ground-contact baseline at ${baseline}.`);
  }

  return { visibleRatio: visible / pixels, baseline };
}

const results = [];
for (const pose of poses) {
  const fileName = `resumilio-cat-${pose}.png`;
  const sitePath = resolve("site/public/images", fileName);
  const starterPath = resolve("starter/site/public/images", fileName);
  const sitePng = await readFile(sitePath);
  const starterPng = await readFile(starterPath);

  if (!sitePng.equals(starterPng)) {
    throw new Error(`${fileName} differs between the product site and starter.`);
  }

  results.push({ pose, ...(await inspect(sitePath)) });
}

const css = await readFile(resolve("site/styles/global.css"), "utf8");
if (css.includes("companion-frames") || css.includes("steps(1,end)")) {
  throw new Error("Legacy stepped sprite animation is still present in the product site.");
}
for (const animation of ["cat-breathe", "cat-blink", "cat-waiting", "cat-nod", "cat-smile", "cat-guide-wide", "cat-guide-mobile"]) {
  if (!css.includes(`@keyframes ${animation}`)) throw new Error(`Missing smooth companion animation: ${animation}.`);
}

console.log(JSON.stringify({ ok: true, poses: results, motion: "continuous-css" }, null, 2));
