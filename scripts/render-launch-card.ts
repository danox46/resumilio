import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright-core";

const chromePath = [process.env.CHROME_PATH, "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium"].find((candidate) => candidate && existsSync(candidate));
if (!chromePath) throw new Error("Chrome was not found. Set CHROME_PATH.");
await mkdir(resolve("docs/release"), { recursive: true });
await mkdir(resolve("public/media"), { recursive: true });

const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ["--no-sandbox"] });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><html><head><style>
    *{box-sizing:border-box}body{margin:0;width:1200px;height:630px;overflow:hidden;background:#f7f3eb;color:#172033;font-family:Inter,Arial,sans-serif}
    main{position:relative;width:100%;height:100%;padding:62px 74px;display:grid;grid-template-columns:1.25fr .75fr;align-items:center;background:radial-gradient(circle at 78% 48%,rgba(211,161,73,.15),transparent 29%),linear-gradient(135deg,#fffdf8 0%,#f2eee5 100%)}
    .eyebrow{color:#406b58;font-size:20px;font-weight:750;letter-spacing:.14em;text-transform:uppercase}.word{display:flex;align-items:center;gap:17px;font:700 34px Georgia,serif;margin-bottom:66px}.mark{width:58px;height:58px;fill:#c07a11}.mark path{stroke:#c07a11;stroke-linecap:round;fill:none}.copy h1{font:700 70px/1.02 Georgia,serif;letter-spacing:-.045em;margin:16px 0 22px;max-width:690px}.copy h1 em{color:#b56d08;font-style:normal}.copy p{font-size:25px;line-height:1.42;max-width:700px;color:#445064;margin:0}.url{position:absolute;left:74px;bottom:54px;font-size:19px;font-weight:700;color:#406b58}
    .orbit{position:relative;width:370px;height:370px;margin-left:auto;border:1px solid rgba(64,107,88,.2);border-radius:50%}.orbit:before,.orbit:after{content:"";position:absolute;border:1px solid rgba(192,122,17,.18);border-radius:50%;inset:44px}.orbit:after{inset:105px;background:#fffdf8;box-shadow:0 18px 60px rgba(23,32,51,.09)}.core{position:absolute;z-index:2;inset:132px;border-radius:50%;background:#172033;display:grid;place-items:center;color:#fff;font:700 21px Georgia,serif;text-align:center}.node{position:absolute;z-index:3;width:22px;height:22px;border-radius:50%;background:#c07a11;border:5px solid #fffdf8;box-shadow:0 5px 16px rgba(23,32,51,.18)}.n1{left:52px;top:40px}.n2{right:18px;top:117px}.n3{right:67px;bottom:33px}.n4{left:18px;bottom:103px}.line{position:absolute;height:2px;background:rgba(64,107,88,.35);transform-origin:left center;z-index:1}.l1{width:145px;left:67px;top:59px;transform:rotate(49deg)}.l2{width:137px;left:203px;top:177px;transform:rotate(-22deg)}.l3{width:132px;left:203px;top:192px;transform:rotate(46deg)}.l4{width:142px;left:56px;top:262px;transform:rotate(-35deg)}
  </style></head><body><main><section class="copy"><div class="word"><svg class="mark" viewBox="0 0 44 44"><path stroke-width="2.2" d="M8 9 7 32M34 8 37 30"/><path fill="#c07a11" d="M7.3 10 20.7 18.4 21.3 17.6 8.7 8ZM33.2 7 20.7 17.6 21.3 18.4 34.8 9ZM6.9 33.3 23 33.5 23 32.5 7.1 30.8ZM36.7 28.8 22.9 32.6 23.1 33.4 37.3 31.2Z"/><path stroke-width="1.8" d="M21 18 23 33"/><g><circle cx="8" cy="9" r="3"/><circle cx="21" cy="18" r="4"/><circle cx="34" cy="8" r="3"/><circle cx="7" cy="32" r="3"/><circle cx="23" cy="33" r="3"/><circle cx="37" cy="30" r="3"/></g></svg><span>resumilio</span></div><div class="eyebrow">Open source · v0.8.0</div><h1>Your career,<br><em>in motion.</em></h1><p>A living, visual resume with connected evidence, a classic backup, and recommendations that react.</p><div class="url">resumilio.danienremoto.com</div></section><div class="orbit"><i class="line l1"></i><i class="line l2"></i><i class="line l3"></i><i class="line l4"></i><i class="node n1"></i><i class="node n2"></i><i class="node n3"></i><i class="node n4"></i><div class="core">Your<br>story</div></div></main></body></html>`);
  const docsPath = resolve("docs/release/resumilio-v0.8.0-social.png");
  await page.screenshot({ path: docsPath });
  await page.screenshot({ path: resolve("public/media/resumilio-v0.8.0-social.png") });
  console.log(docsPath);
} finally {
  await browser.close();
}
