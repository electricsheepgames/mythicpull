import type { Rarity } from './types';

/**
 * Randomized booster generation.
 *
 * Online, a pack's contents are no longer the fixed list in packs.ts — each
 * open draws a fresh, rarity-slotted booster from the set's full card pool
 * (fetched once per set from Scryfall's search API and cached). Selection
 * uses plain Math.random(), deliberately unseeded: any content-derived seed
 * would reproduce the same pack every open, which is exactly the bug this
 * module exists to fix.
 */

const API = 'https://api.scryfall.com';

export interface ScryfallCard {
  id: string;
  name: string;
  set: string;
  set_name: string;
  rarity: Rarity;
  type_line?: string;
  image_uris?: Record<string, string>;
  card_faces?: { image_uris?: Record<string, string>; type_line?: string }[];
  /* Frame metadata — everything data/artBox.ts needs to place the art window. */
  layout?: string;
  frame?: string;
  frame_effects?: string[];
  border_color?: string;
  full_art?: boolean;
  collector_number?: string;
}

export function imageUris(c: ScryfallCard): Record<string, string> | undefined {
  return c.image_uris ?? c.card_faces?.[0]?.image_uris;
}

/* ---------- set pool ---------- */

const poolCache = new Map<string, Promise<ScryfallCard[]>>();

/** Full card pool for a set, fetched once and cached for the session. */
export function fetchSetPool(setCode: string): Promise<ScryfallCard[]> {
  let pool = poolCache.get(setCode);
  if (!pool) {
    pool = loadPool(setCode).catch((err) => {
      poolCache.delete(setCode);
      throw err;
    });
    poolCache.set(setCode, pool);
  }
  return pool;
}

async function loadPool(setCode: string): Promise<ScryfallCard[]> {
  // `is:booster` restricts to cards that actually appear in boosters; not
  // every set flags it, so retry against the whole set before giving up.
  const pool =
    (await search(`e:${setCode} is:booster -t:basic`)) ??
    (await search(`e:${setCode} -t:basic`));
  if (!pool || pool.length === 0) throw new Error(`no cards found for set '${setCode}'`);
  return pool;
}

/** Paginated /cards/search; null when the query matches nothing (HTTP 404). */
async function search(query: string): Promise<ScryfallCard[] | null> {
  const first = new URL(`${API}/cards/search`);
  first.searchParams.set('q', query);
  first.searchParams.set('unique', 'cards');
  let url: string | undefined = first.toString();
  const out: ScryfallCard[] = [];
  while (url) {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Scryfall ${res.status}`);
    const json = (await res.json()) as { data: ScryfallCard[]; has_more?: boolean; next_page?: string };
    out.push(...json.data);
    url = json.has_more ? json.next_page : undefined;
  }
  return out.filter((c) => imageUris(c)?.large);
}

/* ---------- booster generation ---------- */

export interface BoosterCard {
  card: ScryfallCard;
  foil: boolean;
}

const RARITY_ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'mythic'];

/** Relative rarity weights for one slot of the pack. */
type SlotWeights = Partial<Record<Rarity, number>>;

const COMMON: SlotWeights = { common: 1 };
const UNCOMMON: SlotWeights = { uncommon: 1 };
const WILDCARD: SlotWeights = { common: 55, uncommon: 30, rare: 12, mythic: 3 };
const RARE_OR_MYTHIC: SlotWeights = { rare: 6, mythic: 1 };
const FOIL: SlotWeights = { common: 20, uncommon: 20, rare: 45, mythic: 15 };

/**
 * Play-Booster-style layout, 14 cards. The last slot is the foil "money
 * card" — it stays last so the reveal keeps its finale.
 */
const SLOTS: SlotWeights[] = [
  COMMON, COMMON, COMMON, COMMON, COMMON, COMMON, COMMON,
  UNCOMMON, UNCOMMON, UNCOMMON,
  WILDCARD, WILDCARD,
  RARE_OR_MYTHIC,
  FOIL,
];

/**
 * Draw a random rarity-slotted booster from a set pool. No duplicates within
 * a pack. Cards come back in reveal order: commons → mythics, foil last.
 * Throws when the pool can't fill a pack, so callers can fall back.
 */
export function generateBooster(pool: ScryfallCard[]): BoosterCard[] {
  const buckets: Record<Rarity, ScryfallCard[]> = { common: [], uncommon: [], rare: [], mythic: [] };
  for (const c of pool) buckets[c.rarity]?.push(c); // drops 'special'/'bonus' rarities
  let stock = 0;
  for (const r of RARITY_ORDER) {
    shuffle(buckets[r]);
    stock += buckets[r].length;
  }
  if (stock < SLOTS.length) throw new Error(`set pool too small (${stock} usable cards)`);

  const picks: BoosterCard[] = SLOTS.map((weights, i) => ({
    card: buckets[pickRarity(weights, buckets)].pop()!,
    foil: i === SLOTS.length - 1,
  }));

  const finale = picks.pop()!;
  picks.sort((a, b) => RARITY_ORDER.indexOf(a.card.rarity) - RARITY_ORDER.indexOf(b.card.rarity));
  picks.push(finale);
  return picks;
}

function pickRarity(weights: SlotWeights, buckets: Record<Rarity, ScryfallCard[]>): Rarity {
  const stocked = RARITY_ORDER.filter((r) => buckets[r].length > 0);
  const candidates = stocked.filter((r) => (weights[r] ?? 0) > 0);
  if (candidates.length === 0) {
    // Every rarity this slot wants is out of stock (tiny set) — take the
    // stocked rarity nearest the slot's most-weighted one.
    const want = RARITY_ORDER.reduce((a, b) => ((weights[a] ?? 0) >= (weights[b] ?? 0) ? a : b));
    const dist = (r: Rarity) => Math.abs(RARITY_ORDER.indexOf(r) - RARITY_ORDER.indexOf(want));
    return stocked.reduce((a, b) => (dist(a) <= dist(b) ? a : b));
  }
  let total = 0;
  for (const r of candidates) total += weights[r]!;
  let roll = Math.random() * total;
  for (const r of candidates) {
    roll -= weights[r]!;
    if (roll <= 0) return r;
  }
  return candidates[candidates.length - 1];
}

/** In-place Fisher–Yates. */
export function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
