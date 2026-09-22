import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import sharp from "sharp";

const sourceSize = 1024;
const frameSize = 256;
const columns = 8;
const rows = 4;
const frameCount = columns * rows;

const imagesRoot = resolve("site/public/images");
const starterRoot = resolve("starter/site/public/images");

async function rgba(path: string) {
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.width !== sourceSize || info.height !== sourceSize || info.channels !== 4) {
    throw new Error(`${path} must be a ${sourceSize}x${sourceSize} RGBA image.`);
  }
  return new Uint8Array(data);
}

function smoothstep(value: number) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

function amounts(frame: number) {
  const smile = frame < 5 ? 0 : smoothstep((frame - 5) / 6);
  const blink = frame < 12
    ? 0
    : frame <= 16
      ? smoothstep((frame - 12) / 4)
      : frame <= 18
        ? 1
        : frame <= 23
          ? 1 - smoothstep((frame - 18) / 5)
          : 0;
  return { smile, blink };
}

function faceMask(x: number, y: number) {
  const dx = (x - 512) / 365;
  const dy = (y - 300) / 300;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return 1 - smoothstep((distance - 0.82) / 0.2);
}

function blend(target: Uint8Array, overlay: Uint8Array, amount: number, mask: number, offset: number) {
  const alpha = amount * mask * (overlay[offset + 3] / 255);
  if (alpha <= 0) return;
  const inverse = 1 - alpha;
  target[offset] = Math.round(target[offset] * inverse + overlay[offset] * alpha);
  target[offset + 1] = Math.round(target[offset + 1] * inverse + overlay[offset + 1] * alpha);
  target[offset + 2] = Math.round(target[offset + 2] * inverse + overlay[offset + 2] * alpha);
  target[offset + 3] = Math.round(target[offset + 3] * inverse + overlay[offset + 3] * alpha);
}

const idle = await rgba(resolve(imagesRoot, "resumilio-cat-idle.png"));
const smile = await rgba(resolve(imagesRoot, "resumilio-cat-smile.png"));
const blink = await rgba(resolve(imagesRoot, "resumilio-cat-blink.png"));
const frames: Buffer[] = [];

for (let frame = 0; frame < frameCount; frame += 1) {
  const rendered = new Uint8Array(idle);
  const state = amounts(frame);
  for (let y = 0; y < sourceSize; y += 1) {
    for (let x = 0; x < sourceSize; x += 1) {
      const offset = (y * sourceSize + x) * 4;
      const mask = faceMask(x, y);
      blend(rendered, smile, state.smile, mask, offset);
      blend(rendered, blink, state.blink, mask, offset);
    }
  }
  frames.push(await sharp(rendered, { raw: { width: sourceSize, height: sourceSize, channels: 4 } })
    .resize(frameSize, frameSize, { fit: "fill" })
    .png()
    .toBuffer());
}

const sheet = await sharp({
  create: {
    width: columns * frameSize,
    height: rows * frameSize,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite(frames.map((input, frame) => ({
    input,
    left: (frame % columns) * frameSize,
    top: Math.floor(frame / columns) * frameSize,
  })))
  .png()
  .toBuffer();

const fileName = "resumilio-cat-smile-sheet.png";
await writeFile(resolve(imagesRoot, fileName), sheet);
await writeFile(resolve(starterRoot, fileName), sheet);
console.log(`Built ${frameCount}-frame smile sprite sheet at 14 fps: ${fileName}`);
