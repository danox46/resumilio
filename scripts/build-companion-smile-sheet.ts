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
  const { data, info } = await sharp(path)
    .resize(sourceSize, sourceSize, { fit: "fill" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
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
  const smile = frame < 3
    ? 0
    : frame <= 10
      ? smoothstep((frame - 3) / 7)
      : frame <= 25
        ? 1
        : 1 - 0.12 * smoothstep((frame - 25) / 6);
  return { smile };
}

function ellipseMask(x: number, y: number, centerX: number, centerY: number, radiusX: number, radiusY: number) {
  const dx = (x - centerX) / radiusX;
  const dy = (y - centerY) / radiusY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return 1 - smoothstep((distance - 0.78) / 0.22);
}

function expressionMask(x: number, y: number) {
  return ellipseMask(x, y, 512, 420, 255, 125);
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
const smile = await rgba(resolve("assets/companion/resumilio-cat-smile-expression.png"));
const frames: Buffer[] = [];
let staticSmile: Buffer | undefined;

for (let frame = 0; frame < frameCount; frame += 1) {
  const rendered = new Uint8Array(idle);
  const state = amounts(frame);
  for (let y = 0; y < sourceSize; y += 1) {
    for (let x = 0; x < sourceSize; x += 1) {
      const offset = (y * sourceSize + x) * 4;
      blend(rendered, smile, state.smile, expressionMask(x, y), offset);
    }
  }
  if (frame === 18) {
    staticSmile = await sharp(rendered, { raw: { width: sourceSize, height: sourceSize, channels: 4 } }).png().toBuffer();
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
if (!staticSmile) throw new Error("Static smiling pose was not generated.");
await writeFile(resolve(imagesRoot, "resumilio-cat-smile.png"), staticSmile);
await writeFile(resolve(starterRoot, "resumilio-cat-smile.png"), staticSmile);
await writeFile(resolve(imagesRoot, fileName), sheet);
await writeFile(resolve(starterRoot, fileName), sheet);
console.log(`Built ${frameCount}-frame smile sprite sheet at 14 fps: ${fileName}`);
