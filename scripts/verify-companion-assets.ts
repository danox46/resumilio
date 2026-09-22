import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import sharp from "sharp";

const poses = ["idle", "blink", "smile", "guide-wide", "guide-mobile"] as const;
const expectedSize = 1024;
const spriteFrameSize = 256;
const spriteColumns = 8;
const spriteFrames = 32;
const idleSpriteFrames = 64;

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

const idleSpriteName = "resumilio-cat-idle-sheet.png";
const siteIdleSpritePath = resolve("site/public/images", idleSpriteName);
const starterIdleSpritePath = resolve("starter/site/public/images", idleSpriteName);
const siteIdleSprite = await readFile(siteIdleSpritePath);
const starterIdleSprite = await readFile(starterIdleSpritePath);
if (!siteIdleSprite.equals(starterIdleSprite)) throw new Error(`${idleSpriteName} differs between the product site and starter.`);
const idleSpriteMetadata = await sharp(siteIdleSpritePath).metadata();
if (idleSpriteMetadata.width !== spriteFrameSize * spriteColumns || idleSpriteMetadata.height !== spriteFrameSize * 8 || idleSpriteMetadata.channels !== 4) {
  throw new Error(`${idleSpriteName} must be a 2048x2048 RGBA sheet.`);
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

async function spriteRegion(frame: number, left: number, top: number, width: number, height: number) {
  return sharp(siteSpritePath)
    .extract({
      left: (frame % spriteColumns) * spriteFrameSize + left,
      top: Math.floor(frame / spriteColumns) * spriteFrameSize + top,
      width,
      height,
    })
    .raw()
    .toBuffer();
}

function meanAbsoluteDifference(first: Buffer, second: Buffer) {
  if (first.length !== second.length) throw new Error("Cannot compare sprite regions with different sizes.");
  let difference = 0;
  for (let index = 0; index < first.length; index += 1) difference += Math.abs(first[index] - second[index]);
  return difference / first.length;
}

async function idleSpriteRegion(frame: number, left: number, top: number, width: number, height: number) {
  return sharp(siteIdleSpritePath)
    .extract({
      left: (frame % spriteColumns) * spriteFrameSize + left,
      top: Math.floor(frame / spriteColumns) * spriteFrameSize + top,
      width,
      height,
    })
    .raw()
    .toBuffer();
}

const idleOpenEyes = await idleSpriteRegion(0, 70, 42, 116, 72);
const idleBlinkEyes = await idleSpriteRegion(41, 70, 42, 116, 72);
const idleOpenMouth = await idleSpriteRegion(0, 100, 88, 60, 36);
const idleBlinkMouth = await idleSpriteRegion(41, 100, 88, 60, 36);
const idleEyeDifference = meanAbsoluteDifference(idleOpenEyes, idleBlinkEyes);
const idleMouthDifference = meanAbsoluteDifference(idleOpenMouth, idleBlinkMouth);
if (idleEyeDifference < 6) throw new Error(`Idle sprite does not contain a visible blink (${idleEyeDifference.toFixed(2)} MAE).`);
if (idleMouthDifference > 2) throw new Error(`Idle blink unexpectedly changes the accepted mouth style (${idleMouthDifference.toFixed(2)} MAE).`);

let idlePawAnchor: Buffer | undefined;
for (let frame = 0; frame < idleSpriteFrames; frame += 1) {
  const anchor = await idleSpriteRegion(frame, 58, 178, 142, 70);
  if (!idlePawAnchor) idlePawAnchor = anchor;
  else if (!idlePawAnchor.equals(anchor)) throw new Error(`Idle frame ${frame} moved the body or paws outside the eye-only animation region.`);
}

const idleMouth = await spriteRegion(0, 88, 78, 80, 55);
const smilingMouth = await spriteRegion(18, 88, 78, 80, 55);
const idleEyes = await spriteRegion(0, 72, 45, 112, 45);
const smilingEyes = await spriteRegion(18, 72, 45, 112, 45);
const mouthDifference = meanAbsoluteDifference(idleMouth, smilingMouth);
const eyeDifference = meanAbsoluteDifference(idleEyes, smilingEyes);
if (mouthDifference < 10) throw new Error(`Smile does not change the mouth strongly enough (${mouthDifference.toFixed(2)} MAE).`);
if (eyeDifference > 5) throw new Error(`Smile changes the eye region too much and may read as another blink (${eyeDifference.toFixed(2)} MAE).`);

const css = await readFile(resolve("site/styles/global.css"), "utf8");
for (const animation of ["cat-breathe", "cat-waiting", "cat-nod", "cat-smile-settle", "cat-guide-wide", "cat-guide-mobile", "companion-backdrop-guide", "reserve-guide"]) {
  if (!css.includes(`@keyframes ${animation}`)) throw new Error(`Missing smooth companion animation: ${animation}.`);
}
if (css.includes("companion-pose--blink")) throw new Error("Runtime CSS still treats blink as a separate pose.");
if (!css.includes("data-companion-state=\"guide\"") || !css.includes("data-companion-state=\"smile\"")) throw new Error("Constellation background is not synchronized to companion state.");

console.log(JSON.stringify({ ok: true, poses: results, idleSprite: { frames: idleSpriteFrames, fps: 14, width: idleSpriteMetadata.width, height: idleSpriteMetadata.height, pawsAnchored: true, eyeDifference: idleEyeDifference, mouthDifference: idleMouthDifference, blinkIntegrated: true }, smileSprite: { frames: spriteFrames, fps: 14, width: spriteMetadata.width, height: spriteMetadata.height, pawsAnchored: true, mouthDifference, eyeDifference, distinctFromBlink: true }, backgroundStates: ["idle", "waiting", "nod", "smile", "guide"], motion: "sprite-state-machine" }, null, 2));
