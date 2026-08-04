// Validate every card ref and keyArt spec in src/data/packs.ts against the
// live Scryfall API — catches misspelled names, wrong set pins, stale rarity
// hints, and missing imagery before they silently degrade a pack at runtime.
//
//   npm run validate:packs
//
// Zero dependencies (plain node fetch + a light regex parse of the registry).
// Exit code 1 on hard failures (unresolvable name / missing image or art);
// rarity-hint mismatches are warnings only, since online the app always uses
// Scryfall's real rarity.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const packsFile = join(dirname(fileURLToPath(import.meta.url)), '../src/data/packs.ts');
const src = readFileSync(packsFile, 'utf8');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Scryfall asks for an identifying User-Agent: https://scryfall.com/docs/api
const HDRS = { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': 'MythicPull-pack-validator/0.1' };

const packs = [];
for (const block of src.split(/\n  \{\n/).slice(1)) {
  const id = block.match(/id: '([^']+)'/)?.[1];
  if (!id) continue;
  const keyArt = block.match(/keyArt: 'scryfall-art:([^:]+):([a-z0-9]+)'/);
  const cards = [];
  const re =
    /\{ name: '((?:[^'\\]|\\.)*)'(?:, set: '([a-z0-9]+)')?(?:, collectorNumber: '([^']+)')?(?:, rarity: '(\w+)')?[^}]*\}/g;
  for (let m; (m = re.exec(block)); )
    cards.push({ name: m[1].replace(/\\'/g, "'"), set: m[2], collectorNumber: m[3], rarity: m[4] });
  packs.push({ id, keyArt: keyArt ? { name: keyArt[1], set: keyArt[2] } : null, cards });
}

/** Mirrors cardIdentifier() in src/data/scryfall.ts. */
const identifier = (c) =>
  c.set && c.collectorNumber
    ? { set: c.set, collector_number: c.collectorNumber }
    : c.set
      ? { name: c.name, set: c.set }
      : { name: c.name };

/**
 * Mirrors matchCard() in src/data/scryfall.ts — matched the way it was asked
 * for, with a prefix pass for double-faced names like "Oko, Lorwyn Liege // …".
 */
function match(data, c) {
  if (c.set && c.collectorNumber) {
    return data.find((d) => d.set === c.set && d.collector_number === c.collectorNumber);
  }
  const name = c.name.toLowerCase();
  return (
    data.find((d) => d.name.toLowerCase() === name) ??
    data.find((d) => d.name.toLowerCase().startsWith(name))
  );
}

let hardFailures = 0;
let warnings = 0;
for (const p of packs) {
  const res = await fetch('https://api.scryfall.com/cards/collection', {
    method: 'POST',
    headers: HDRS,
    body: JSON.stringify({ identifiers: p.cards.map(identifier) }),
  });
  if (!res.ok) {
    console.error(`${p.id}: Scryfall HTTP ${res.status}`);
    hardFailures++;
    continue;
  }
  const json = await res.json();
  console.log(`\n=== ${p.id} — ${json.data.length}/${p.cards.length} resolved ===`);
  for (const nf of json.not_found ?? []) {
    console.log('  ❌ NOT FOUND:', JSON.stringify(nf));
    hardFailures++;
  }
  for (const c of p.cards) {
    const hit = match(json.data, c);
    if (!hit) continue;
    const uris = hit.image_uris ?? hit.card_faces?.[0]?.image_uris;
    if (!uris?.large) {
      console.log(`  ❌ ${c.name}: no large image`);
      hardFailures++;
    }
    // A collector-number pin exists to select a treatment, so a printing whose
    // name doesn't match the ref means the pin points at the wrong card.
    if (c.collectorNumber && !hit.name.toLowerCase().startsWith(c.name.toLowerCase())) {
      console.log(`  ❌ ${c.set} ${c.collectorNumber}: expected "${c.name}", got "${hit.name}"`);
      hardFailures++;
    }
    if (c.rarity && hit.rarity !== c.rarity) {
      console.log(`  ⚠️ ${c.name}: rarity hint '${c.rarity}' but Scryfall says '${hit.rarity}' [${hit.set}]`);
      warnings++;
    }
  }
  if (p.keyArt) {
    const u = new URL('https://api.scryfall.com/cards/named');
    u.searchParams.set('exact', p.keyArt.name);
    u.searchParams.set('set', p.keyArt.set);
    const r = await fetch(u, { headers: HDRS });
    if (!r.ok) {
      console.log(`  ❌ keyArt "${p.keyArt.name}" (${p.keyArt.set}): HTTP ${r.status}`);
      hardFailures++;
    } else {
      const card = await r.json();
      const art = (card.image_uris ?? card.card_faces?.[0]?.image_uris)?.art_crop;
      console.log(`  keyArt "${p.keyArt.name}": ${art ? '✓ art_crop' : '❌ no art_crop'}`);
      if (!art) hardFailures++;
    }
  }
  await sleep(150); // stay well under Scryfall's rate guidance
}

console.log(`\n${hardFailures} hard failure(s), ${warnings} rarity-hint warning(s)`);
process.exit(hardFailures ? 1 : 0);
