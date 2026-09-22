import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import sharp from "sharp";

const poses = ["idle", "blink", "smile", "guide-wide", "guide-mobile"] as const;
const expectedSize = 1024;
const spriteFrameSize = 256;
const spriteColumns = 8;
const spriteFrames = 32;

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

const spriteName = "resumilio-cat-smile-sheet.png";
const siteSpritePath = resolve("site/public/images", spriteName);
const starterSpritePath = resolve("starter/site/public/images", spriteName);
const siteSprite = await readFile(siteSpritePath);
const starterSprite = await readFile(starterSpritePath);
if (!siteSprite.equals(starterSprite)) throw new Error(`${spriteName} differs between the product site and starter.`);

const spriteMetadata = await sharp(siteSpritePath).metadata();
if (spriteMetadata.width !== spriteFrameSize * spriteColumns || spriteMetadata.height !== spriteFrameSize * 4 || spriteMetadata.channels !== 4) {
  throw new Error(`${spriteName} must be a 2048x1024 RGBA sheet.`);
}

let pawAnchor: Buffer | undefined;
for (let frame = 0; frame < spriteFrames; frame += 1) {
  const left = (frame % spriteColumns) * spriteFrameSize + 58;
  const top = Math.floor(frame / spriteColumns) * spriteFrameSize + 178;
  const anchor = await sharp(siteSpritePath).extract({ left, top, width: 142, height: 70 }).raw().toBuffer();
  if (!pawAnchor) pawAnchor = anchor;
  else if (!pawAnchor.equals(anchor)) throw new Error(`Smile frame ${frame} moved the body or paws outside the face-only animation region.`);
}

const css = await readFile(resolve("site/styles/global.css"), "utf8");
if (!css.includes("2.285714s steps(1,end)")) throw new Error("Smile sheet is not configured for 32 frames at 14 fps.");
for (const animation of ["cat-breathe", "cat-blink", "cat-waiting", "cat-nod", "cat-smile-frames", "cat-guide-wide", "cat-guide-mobile"]) {
  if (!css.includes(`@keyframes ${animation}`)) throw new Error(`Missing smooth companion animation: ${animation}.`);
}

console.log(JSON.stringify({ ok: true, poses: results, smileSprite: { frames: spriteFrames, fps: 14, width: spriteMetadata.width, height: spriteMetadata.height, pawsAnchored: true }, motion: "hybrid-css-and-sprite" }, null, 2));
