import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import sharp from "sharp";

const sheetNames = [
  "idle",
  "waiting",
  "nod",
  "smile",
  "guide-wide",
  "guide-mobile",
] as const;

const sheetSize = 1024;
const cellSize = 256;
const frameCount = 16;
const targetBaselineY = 246;
const alphaThreshold = 40;

function frameOffset(frameIndex: number) {
  return {
    x: (frameIndex % 4) * cellSize,
    y: Math.floor(frameIndex / 4) * cellSize,
  };
}

async function readSheet(path: string) {
  const { data, info } = await sharp(path)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (info.width !== sheetSize || info.height !== sheetSize || info.channels !== 4) {
    throw new Error(`${path} must be a ${sheetSize}x${sheetSize} RGBA PNG.`);
  }

  return new Uint8Array(data);
}

function extractFrame(sheet: Uint8Array, frameIndex: number) {
  const frame = new Uint8Array(cellSize * cellSize * 4);
  const offset = frameOffset(frameIndex);

  for (let y = 0; y < cellSize; y += 1) {
    const sourceStart = ((offset.y + y) * sheetSize + offset.x) * 4;
    frame.set(
      sheet.subarray(sourceStart, sourceStart + cellSize * 4),
      y * cellSize * 4,
    );
  }

  return frame;
}

function baseline(frame: Uint8Array) {
  let result = -1;
  for (let y = 0; y < cellSize; y += 1) {
    for (let x = 0; x < cellSize; x += 1) {
      if (frame[(y * cellSize + x) * 4 + 3] > alphaThreshold) result = y;
    }
  }
  return result;
}

function verifyHardPawAnchor(
  frame: Uint8Array,
  canonical: Uint8Array,
  label: string,
) {
  for (let y = 208; y < cellSize; y += 1) {
    for (let x = 100; x <= 226; x += 1) {
      const index = (y * cellSize + x) * 4;
      for (let channel = 0; channel < 4; channel += 1) {
        if (frame[index + channel] !== canonical[index + channel]) {
          throw new Error(`${label} moved inside the fixed front-paw region.`);
        }
      }
    }
  }

  if (Math.abs(baseline(frame) - targetBaselineY) > 1) {
    throw new Error(`${label} has a drifting ground-contact baseline.`);
  }
}

const siteImages = resolve("site/public/images");
const idleSheet = await readSheet(resolve(siteImages, "resumilio-companion-idle.png"));
const canonicalPaws = extractFrame(idleSheet, 0);

for (const sheetName of sheetNames) {
  const fileName = `resumilio-companion-${sheetName}.png`;
  const sitePath = resolve(siteImages, fileName);
  const starterPath = resolve("starter/site/public/images", fileName);
  const sitePng = await readFile(sitePath);
  const starterPng = await readFile(starterPath);

  if (!sitePng.equals(starterPng)) {
    throw new Error(`${fileName} differs between the product site and starter.`);
  }

  const sheet = await readSheet(sitePath);
  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    verifyHardPawAnchor(
      extractFrame(sheet, frameIndex),
      canonicalPaws,
      `${sheetName} frame ${frameIndex + 1}`,
    );
  }
}

console.log("Verified 96 companion frames against the fixed front-paw anchor.");
