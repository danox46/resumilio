import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import sharp from "sharp";

const sourceSize = 1024;
const frameSize = 256;
const columns = 8;
const rows = 8;
const frameCount = columns * rows;
const imagesRoot = resolve("site/public/images");
const starterRoot = resolve("starter/site/public/images");

async function rgba(path: string) {
  const { data, info } = await sharp(path).resize(sourceSize, sourceSize, { fit: "fill" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.width !== sourceSize || info.height !== sourceSize || info.channels !== 4) {
    throw new Error(`${path} must be a ${sourceSize}x${sourceSize} RGBA image.`);
  }
  return new Uint8Array(data);
}

function smoothstep(value: number) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

function eyeMask(x: number, y: number) {
  const dx = (x - 512) / 278;
  const dy = (y - 294) / 126;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return 1 - smoothstep((distance - 0.76) / 0.24);
}

function blinkAmount(frame: number) {
  if (frame < 38 || frame > 45) return 0;
  return frame <= 41 ? smoothstep((frame - 38) / 3) : 1 - smoothstep((frame - 41) / 4);
}

const idle = await rgba(resolve(imagesRoot, "resumilio-cat-idle.png"));
const blink = await rgba(resolve(imagesRoot, "resumilio-cat-blink.png"));
const frames: Buffer[] = [];

for (let frame = 0; frame < frameCount; frame += 1) {
  const rendered = new Uint8Array(idle);
  const amount = blinkAmount(frame);
  if (amount > 0) {
    for (let y = 130; y < 450; y += 1) for (let x = 210; x < 814; x += 1) {
      const offset = (y * sourceSize + x) * 4;
      const alpha = amount * eyeMask(x, y) * (blink[offset + 3] / 255);
      if (alpha <= 0) continue;
      const inverse = 1 - alpha;
      rendered[offset] = Math.round(rendered[offset] * inverse + blink[offset] * alpha);
      rendered[offset + 1] = Math.round(rendered[offset + 1] * inverse + blink[offset + 1] * alpha);
      rendered[offset + 2] = Math.round(rendered[offset + 2] * inverse + blink[offset + 2] * alpha);
      rendered[offset + 3] = Math.round(rendered[offset + 3] * inverse + blink[offset + 3] * alpha);
    }
  }
  frames.push(await sharp(rendered, { raw: { width: sourceSize, height: sourceSize, channels: 4 } }).resize(frameSize, frameSize, { fit: "fill" }).png().toBuffer());
}

const sheet = await sharp({
  create: {
    width: columns * frameSize,
    height: rows * frameSize,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
}).composite(frames.map((input, frame) => ({
  input,
  left: (frame % columns) * frameSize,
  top: Math.floor(frame / columns) * frameSize,
}))).png().toBuffer();

const fileName = "resumilio-cat-idle-sheet.png";
await writeFile(resolve(imagesRoot, fileName), sheet);
await writeFile(resolve(starterRoot, fileName), sheet);
console.log(`Built ${frameCount}-frame idle-and-blink sprite sheet at 14 fps: ${fileName}`);
