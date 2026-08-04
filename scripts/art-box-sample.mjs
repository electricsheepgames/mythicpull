// Re-derive the art-window table in src/data/artBox.ts from real card images.
//
//   node scripts/art-box-sample.mjs            # sample, measure, cluster
//   PER_BUCKET=6 node scripts/art-box-sample.mjs
//
// How it works: Scryfall publishes an `art_crop` for every printing, cut from
// the same scan as the full card image. Locating that crop back inside the
// card image recovers the frame's art rectangle exactly — no eyeballing, no
// hand-measuring. Matching is normalized cross-correlation over a coarse-to-
// fine search of (x, y, width); height is pinned by the crop's own aspect
// ratio, which is known. Results are then clustered, and each cluster's median
// is a row of the table.
//
// One caveat the clustering can't see: `art_crop` is a *thumbnail* preset, so
// for borderless and full-art printings it returns the standard window rather
// than the painting's true extent. Those rows in artBox.ts were set from the
// printed art instead — check them with scripts/art-box-report.mjs, not here.
//
// Needs a browser to decode JPEG (node has no decoder and this repo has no
// dependencies); the page itself never touches the network — images are passed
// in as data URLs. Node also needs its proxy opt-ins in sandboxes:
//   NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  console.error(
    'This script needs Playwright to decode card images.\n' +
      '  npx --yes playwright@1 install chromium\n' +
      '  npm exec --yes --package=playwright@1 -- node scripts/art-box-sample.mjs',
  );
  process.exit(1);
}

const API = 'https://api.scryfall.com';
const HDRS = { Accept: 'application/json', 'User-Agent': 'MythicPull-artbox-sample/0.1' };
const PER_BUCKET = Number(process.env.PER_BUCKET ?? 4);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * One query per frame family we care about. Add a bucket whenever a set
 * introduces a treatment the table doesn't cover yet.
 */
const BUCKETS = {
  'normal-2015': 'frame:2015 layout:normal -is:fullart -is:extendedart -border:borderless -is:showcase -t:planeswalker -t:basic',
  'normal-2003': 'frame:2003 layout:normal -is:fullart -border:borderless',
  'normal-1997': 'frame:1997 layout:normal -is:fullart',
  'normal-1993': 'frame:1993 layout:normal -is:fullart',
  planeswalker: 't:planeswalker frame:2015 -border:borderless -is:showcase -is:extendedart',
  saga: 'layout:saga -border:borderless',
  class: 'layout:class -border:borderless',
  case: 'layout:case -border:borderless',
  flip: 'layout:flip',
  adventure: 'layout:adventure -border:borderless -is:showcase',
  transform: 'is:transform -border:borderless -is:showcase frame:2015',
  mdfc: 'is:mdfc -border:borderless -is:showcase',
  extendedart: 'frame:extendedart -is:showcase',
  showcase: 'is:showcase -is:fullart -border:borderless',
  'fullart-basic': 'is:fullart t:basic',
  'fullart-nonbasic': 'is:fullart -t:basic -border:borderless',
  borderless: 'border:borderless -is:showcase -t:planeswalker -t:basic',
  'borderless-pw': 'border:borderless t:planeswalker',
};

/* ---------- sample ---------- */

const samples = [];
for (const [style, q] of Object.entries(BUCKETS)) {
  const url = new URL(`${API}/cards/search`);
  url.searchParams.set('q', `${q} -is:digital lang:en`);
  url.searchParams.set('unique', 'prints');
  url.searchParams.set('order', 'released');
  url.searchParams.set('dir', 'desc');

  let hits;
  try {
    const res = await fetch(url, { headers: HDRS });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    hits = (await res.json()).data ?? [];
  } catch (err) {
    console.warn(`! ${style}: ${err.message}`);
    continue;
  }
  await sleep(120);

  // Spread the picks across the page so a bucket isn't four cards from one set.
  const step = Math.max(1, Math.floor(hits.length / PER_BUCKET));
  for (let i = 0; samples.filter((s) => s.style === style).length < PER_BUCKET && i < hits.length; i += step) {
    const c = hits[i];
    const uris = c.image_uris ?? c.card_faces?.[0]?.image_uris;
    if (!uris?.normal || !uris?.art_crop) continue;
    try {
      const [card, art] = await Promise.all([dataUrl(uris.normal), dataUrl(uris.art_crop)]);
      samples.push({
        style,
        name: c.name,
        set: c.set,
        number: c.collector_number,
        layout: c.layout,
        frame: c.frame,
        effects: c.frame_effects ?? [],
        border: c.border_color,
        fullArt: !!c.full_art,
        card,
        art,
      });
    } catch (err) {
      console.warn(`! ${c.set} ${c.collector_number}: ${err.message}`);
    }
    await sleep(80);
  }
  console.log(`${style}: ${samples.filter((s) => s.style === style).length}`);
}

/* ---------- measure ---------- */

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('about:blank');
await page.addScriptTag({ content: MATCHER() });

const measured = [];
for (const s of samples) {
  try {
    const box = await page.evaluate(([c, a]) => measure(c, a), [s.card, s.art]);
    measured.push({ ...s, box, card: undefined, art: undefined });
    console.log(
      `${box.score.toFixed(3)}  ${`${s.style} ${s.set} ${s.number}`.padEnd(34)}` +
        ` x=${box.x.toFixed(4)} y=${box.y.toFixed(4)} w=${box.w.toFixed(4)} h=${box.h.toFixed(4)}`,
    );
  } catch (err) {
    console.warn(`! ${s.set} ${s.number}: ${err.message}`);
  }
}
await browser.close();

/* ---------- cluster ---------- */

// Scryfall crops from a small set of per-frame presets, so good measurements
// pile up on a handful of rectangles. Bucketing at 1/40 of the card separates
// them cleanly while absorbing scan-to-scan jitter.
const clusters = new Map();
for (const m of measured.filter((r) => r.box.score >= 0.9)) {
  const key = [m.box.x, m.box.y, m.box.w, m.box.h].map((v) => Math.round(v * 40)).join(',');
  if (!clusters.has(key)) clusters.set(key, []);
  clusters.get(key).push(m);
}

console.log('\n=== clusters (>= 2 members, best match first) ===');
for (const group of [...clusters.values()].sort((a, b) => b.length - a.length)) {
  if (group.length < 2) continue;
  const stat = (p) => {
    const vals = group.map((g) => g.box[p]).sort((a, b) => a - b);
    return { med: vals[vals.length >> 1], spread: vals[vals.length - 1] - vals[0] };
  };
  const [x, y, w, h] = ['x', 'y', 'w', 'h'].map(stat);
  console.log(
    `\nn=${group.length}  { x: ${x.med.toFixed(3)}, y: ${y.med.toFixed(3)}, ` +
      `w: ${w.med.toFixed(3)}, h: ${h.med.toFixed(3)} }`,
  );
  console.log(
    `  spread  x ${x.spread.toFixed(4)}  y ${y.spread.toFixed(4)}  ` +
      `w ${w.spread.toFixed(4)}  h ${h.spread.toFixed(4)}`,
  );
  console.log(`  styles  ${[...new Set(group.map((g) => g.style))].join(', ')}`);
  console.log(`  frames  ${[...new Set(group.map((g) => g.frame))].join(',')}` +
    `  layouts ${[...new Set(group.map((g) => g.layout))].join(',')}`);
}

const out = join(await mkdtemp(join(tmpdir(), 'mythicpull-artbox-')), 'measured.json');
await writeFile(out, JSON.stringify(measured, null, 2));
console.log(`\n${measured.length} measured; raw data at ${out}`);

async function dataUrl(url) {
  const res = await fetch(url, { headers: { 'User-Agent': HDRS['User-Agent'] } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return `data:image/jpeg;base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`;
}

/** Everything below runs inside the page, where JPEG decoding exists. */
function MATCHER() {
  return `
function gray(bitmap, w, h) {
  const ctx = new OffscreenCanvas(w, h).getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0, w, h);
  const px = ctx.getImageData(0, 0, w, h).data;
  const out = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    out[i] = (0.2126 * px[o] + 0.7152 * px[o + 1] + 0.0722 * px[o + 2]) / 255;
  }
  return out;
}

function sample(buf, w, h, u, v) {
  const x = Math.min(w - 1.001, Math.max(0, u * w - 0.5));
  const y = Math.min(h - 1.001, Math.max(0, v * h - 0.5));
  const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0, i = y0 * w + x0;
  const a = buf[i], b = buf[i + 1], c = buf[i + w], d = buf[i + w + 1];
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

/** Resample a normalized rect onto an n x n grid, mean/std normalized. */
function patch(buf, w, h, box, n, out) {
  let sum = 0;
  for (let j = 0; j < n; j++) {
    const v = box.y + box.h * ((j + 0.5) / n);
    for (let i = 0; i < n; i++) {
      const val = sample(buf, w, h, box.x + box.w * ((i + 0.5) / n), v);
      out[j * n + i] = val;
      sum += val;
    }
  }
  const mean = sum / (n * n);
  let ss = 0;
  for (let i = 0; i < n * n; i++) { out[i] -= mean; ss += out[i] * out[i]; }
  const inv = 1 / Math.sqrt(ss + 1e-6);
  for (let i = 0; i < n * n; i++) out[i] *= inv;
  return out;
}

function ncc(a, b, n) {
  let s = 0;
  for (let i = 0; i < n * n; i++) s += a[i] * b[i];
  return s;
}

/** Best (x, y, w) in the given ranges; h follows from the crop's aspect. */
function search(card, cw, ch, tmpl, n, aspect, r) {
  const buf = new Float32Array(n * n);
  let best = null;
  for (let w = r.w0; w <= r.w1 + 1e-9; w += r.step) {
    const h = (w * cw) / (ch * aspect);
    if (h > 1.02 || w > 1.02) continue;
    for (let x = r.x0; x <= r.x1 + 1e-9; x += r.step) {
      for (let y = r.y0; y <= r.y1 + 1e-9; y += r.step) {
        if (x < -0.02 || y < -0.02 || x + w > 1.02 || y + h > 1.02) continue;
        const score = ncc(tmpl, patch(card, cw, ch, { x, y, w, h }, n, buf), n);
        if (!best || score > best.score) best = { x, y, w, h, score };
      }
    }
  }
  return best;
}

async function measure(cardUrl, artUrl) {
  const [cardBmp, artBmp] = await Promise.all([
    fetch(cardUrl).then((r) => r.blob()).then(createImageBitmap),
    fetch(artUrl).then((r) => r.blob()).then(createImageBitmap),
  ]);
  const aspect = artBmp.width / artBmp.height;

  // Coarse pass on a small copy, refinements on a larger one.
  const cw1 = 192, ch1 = Math.round((192 * cardBmp.height) / cardBmp.width);
  const cw2 = 480, ch2 = Math.round((480 * cardBmp.height) / cardBmp.width);
  const card1 = gray(cardBmp, cw1, ch1);
  const card2 = gray(cardBmp, cw2, ch2);
  const aw = 128, ah = Math.max(1, Math.round(128 / aspect));
  const art = gray(artBmp, aw, ah);

  const full = { x: 0, y: 0, w: 1, h: 1 };
  const t16 = patch(art, aw, ah, full, 16, new Float32Array(16 * 16));
  const t32 = patch(art, aw, ah, full, 32, new Float32Array(32 * 32));
  const t48 = patch(art, aw, ah, full, 48, new Float32Array(48 * 48));

  const coarse = search(card1, cw1, ch1, t16, 16, aspect,
    { w0: 0.24, w1: 1.0, x0: 0, x1: 0.76, y0: 0, y1: 0.9, step: 0.02 });
  const mid = search(card2, cw2, ch2, t32, 32, aspect,
    { w0: coarse.w - 0.03, w1: coarse.w + 0.03, x0: coarse.x - 0.03, x1: coarse.x + 0.03,
      y0: coarse.y - 0.03, y1: coarse.y + 0.03, step: 0.005 });
  return search(card2, cw2, ch2, t48, 48, aspect,
    { w0: mid.w - 0.006, w1: mid.w + 0.006, x0: mid.x - 0.006, x1: mid.x + 0.006,
      y0: mid.y - 0.006, y1: mid.y + 0.006, step: 0.0015 });
}
`;
}
