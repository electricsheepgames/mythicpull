// Render the art windows that src/data/artBox.ts picks over the real card
// images, as a self-contained HTML contact sheet. This is how you check the
// classifier after a set introduces a new frame treatment: open the report and
// look for a rectangle that isn't sitting on the painting.
//
//   node --experimental-strip-types scripts/art-box-report.mjs [packId]
//   open art-box-report.html
//
// Defaults to the `relief` demo pack, which exists to cover every frame family
// at once. Pass a pack id for any other pack, or `all` for the whole registry.
//
// Zero dependencies: plain node fetch, the real classifier imported straight
// from src/, and images inlined as data URLs so the report can be opened or
// shared without network access.
//
// Node needs its proxy opt-ins in sandboxes:
//   NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { artBoxFor } from '../src/data/artBox.ts';
import { PACKS } from '../src/data/packs.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'art-box-report.html');
const HDRS = { Accept: 'application/json', 'User-Agent': 'MythicPull-artbox-report/0.1' };

const want = process.argv[2] ?? 'relief';
const packs = want === 'all' ? PACKS : PACKS.filter((p) => p.id === want);
if (packs.length === 0) {
  console.error(`no pack '${want}'. Known: ${PACKS.map((p) => p.id).join(', ')}`);
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Same identifier shape the app sends — see cardIdentifier() in scryfall.ts. */
const identifier = (c) =>
  c.set && c.collectorNumber
    ? { set: c.set, collector_number: c.collectorNumber }
    : c.set
      ? { name: c.name, set: c.set }
      : { name: c.name };

const cells = [];
for (const pack of packs) {
  const res = await fetch('https://api.scryfall.com/cards/collection', {
    method: 'POST',
    headers: { ...HDRS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifiers: pack.cards.map(identifier) }),
  });
  if (!res.ok) {
    console.error(`${pack.id}: Scryfall HTTP ${res.status}`);
    process.exit(1);
  }
  const { data } = await res.json();

  for (const ref of pack.cards) {
    const hit =
      ref.set && ref.collectorNumber
        ? data.find((d) => d.set === ref.set && d.collector_number === ref.collectorNumber)
        : (data.find((d) => d.name.toLowerCase() === ref.name.toLowerCase()) ??
           data.find((d) => d.name.toLowerCase().startsWith(ref.name.toLowerCase())));
    if (!hit) {
      console.warn(`  ! unresolved: ${ref.name}`);
      continue;
    }
    const uris = hit.image_uris ?? hit.card_faces?.[0]?.image_uris;
    if (!uris?.normal) {
      console.warn(`  ! no image: ${hit.name}`);
      continue;
    }

    const box = artBoxFor({
      layout: hit.layout,
      frame: hit.frame,
      frameEffects: hit.frame_effects,
      borderColor: hit.border_color,
      fullArt: hit.full_art,
      typeLine: hit.card_faces?.[0]?.type_line ?? hit.type_line,
    });

    const img = await fetch(uris.normal, { headers: HDRS });
    if (!img.ok) {
      console.warn(`  ! image HTTP ${img.status}: ${hit.name}`);
      continue;
    }
    cells.push({
      pack: pack.id,
      name: hit.name,
      src: `data:image/jpeg;base64,${Buffer.from(await img.arrayBuffer()).toString('base64')}`,
      box,
      meta: [
        hit.layout,
        `frame ${hit.frame}`,
        hit.border_color,
        hit.full_art ? 'full-art' : null,
        ...(hit.frame_effects ?? []),
      ]
        .filter(Boolean)
        .join(' · '),
    });
    console.log(`  ${hit.name} — ${hit.set} ${hit.collector_number}`);
    await sleep(60); // stay well under Scryfall's rate guidance
  }
}

const html = `<!doctype html><meta charset="utf-8"><title>MythicPull art windows</title>
<style>
  body { margin: 0; padding: 24px; background: #14121c; color: #ddd;
         font: 12px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace; }
  h1 { font-size: 15px; font-weight: 600; margin: 0 0 4px; }
  p  { margin: 0 0 22px; color: #8d87a3; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 20px; }
  .card { position: relative; aspect-ratio: 672 / 936; background: #000; border-radius: 4%; overflow: hidden; }
  .card img { width: 100%; height: 100%; display: block; }
  /* Everything outside the window is dimmed, so a misplaced rectangle is
     obvious at a glance rather than something you have to look for. */
  .box { position: absolute; outline: 2px solid #4fd8ff;
         box-shadow: 0 0 0 9999px rgba(10, 8, 20, 0.62); }
  .name { margin-top: 7px; color: #efeaff; }
  .meta { color: #8d87a3; }
</style>
<h1>Art windows — ${cells.length} printings</h1>
<p>Lit rectangle = what <code>artBoxFor()</code> picked. The relief effect runs inside it only.</p>
<div class="grid">
${cells
  .map(
    (c) => `<div>
  <div class="card"><img src="${c.src}" alt="${escapeHtml(c.name)}">
    <div class="box" style="left:${pct(c.box.x)};top:${pct(c.box.y)};width:${pct(c.box.w)};height:${pct(c.box.h)}"></div>
  </div>
  <div class="name">${escapeHtml(c.name)}</div>
  <div class="meta">${escapeHtml(c.meta)}</div>
</div>`,
  )
  .join('\n')}
</div>`;

await writeFile(OUT, html);
console.log(`\n${cells.length} cards -> ${OUT}`);

function pct(v) {
  return `${(v * 100).toFixed(2)}%`;
}

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
}
