import type { CardData, PackCardRef, PackDefinition } from './types';
import { mockCardsFor, mockCardBack, mockKeyArt } from './mock';
import { fetchSetPool, generateBooster, imageUris, type ScryfallCard } from './booster';
import { artBoxFor } from './artBox';

/**
 * Thin Scryfall client.
 *
 * - Card fronts come from `image_uris` (large ≈ 672x936 JPG; Scryfall also
 *   serves `png` at 745x1040 if we ever want alpha corners).
 * - The classic Magic card back is served from Scryfall's backs CDN under the
 *   default card_back_id.
 * - Everything degrades to procedurally drawn mock assets when offline or
 *   when `?mock=1` is in the URL, so the whole experience works without
 *   network access.
 */

const API = 'https://api.scryfall.com';

/** Scryfall's default card back (card_back_id 0aeebaf5-8c7d-4636-9e82-8c27447861f7). */
export const CARD_BACK_URL =
  'https://backs.scryfall.io/large/0/a/0aeebaf5-8c7d-4636-9e82-8c27447861f7.jpg';

export const FORCE_MOCK = new URLSearchParams(location.search).has('mock');

let cardBackResolved: string | null = null;

/** Card back image, falling back to a drawn one if the CDN is unreachable. */
export async function getCardBack(): Promise<string> {
  if (cardBackResolved) return cardBackResolved;
  if (!FORCE_MOCK && (await imageLoads(CARD_BACK_URL))) {
    cardBackResolved = CARD_BACK_URL;
  } else {
    cardBackResolved = mockCardBack();
  }
  return cardBackResolved;
}

function toCardData(hit: ScryfallCard, foil: boolean, uris: Record<string, string>): CardData {
  return {
    id: hit.id,
    name: hit.name,
    setCode: hit.set,
    setName: hit.set_name,
    rarity: hit.rarity,
    typeLine: hit.type_line ?? '',
    imageLarge: uris.large,
    imageNormal: uris.normal ?? uris.large,
    foil,
    artBox: artBoxFor({
      layout: hit.layout,
      frame: hit.frame,
      frameEffects: hit.frame_effects,
      borderColor: hit.border_color,
      fullArt: hit.full_art,
      // Double-faced cards carry the type line per face; the image we show is
      // the front, so that's the face the art window belongs to.
      typeLine: hit.card_faces?.[0]?.type_line ?? hit.type_line,
    }),
  };
}

/**
 * Cards for one pack opening. Online, every open rolls a fresh rarity-slotted
 * booster from the set's full pool (see booster.ts); the curated list in
 * packs.ts is only the fallback when that fails.
 */
export async function fetchPackCards(pack: PackDefinition): Promise<CardData[]> {
  if (FORCE_MOCK) return mockCardsFor(pack);
  // Demo packs pin their contents — no roll, no shuffle, same eight cards
  // every time so the thing being demonstrated is the only variable.
  if (pack.fixedContents) return fetchCuratedCards(pack);
  try {
    const pool = await fetchSetPool(pack.setCode);
    return generateBooster(pool).map(({ card, foil }) => toCardData(card, foil, imageUris(card)!));
  } catch (err) {
    console.warn('[scryfall] booster generation failed, using curated list:', err);
    return fetchCuratedCards(pack);
  }
}

/** Resolve the pack's curated card refs into CardData via POST /cards/collection. */
async function fetchCuratedCards(pack: PackDefinition): Promise<CardData[]> {
  try {
    const res = await fetch(`${API}/cards/collection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ identifiers: pack.cards.map(cardIdentifier) }),
    });
    if (!res.ok) throw new Error(`Scryfall ${res.status}`);
    const json = (await res.json()) as { data: ScryfallCard[]; not_found?: unknown[] };
    const cards: CardData[] = [];
    for (const ref of pack.cards) {
      const hit = matchCard(json.data, ref);
      if (!hit) continue;
      const uris = imageUris(hit);
      if (!uris?.large) continue;
      cards.push(toCardData(hit, ref.foil ?? hit.rarity === 'mythic', uris));
    }
    // A partial resolve is fine for a fallback list — 13 real cards beat a
    // mock pack. But a fixed-contents pack promises an exact list, and the
    // loop above skips refs silently, so a renamed card or a missing image
    // would quietly shorten the pack. Take the complete mock pack instead.
    if (pack.fixedContents && cards.length !== pack.cards.length) {
      throw new Error(`fixed contents resolved ${cards.length}/${pack.cards.length} cards`);
    }
    if (cards.length === 0) throw new Error('no cards resolved');
    return cards;
  } catch (err) {
    console.warn('[scryfall] falling back to mock cards:', err);
    return mockCardsFor(pack);
  }
}

/**
 * Scryfall `/cards/collection` identifier for one pack ref. A collector number
 * pins the exact printing — the only way to ask for a *treatment* (showcase,
 * borderless, extended art), since every treatment shares the card's name.
 */
function cardIdentifier(ref: PackCardRef): Record<string, string> {
  if (ref.set && ref.collectorNumber) return { set: ref.set, collector_number: ref.collectorNumber };
  return ref.set ? { name: ref.name, set: ref.set } : { name: ref.name };
}

/**
 * Find a ref's card in the collection response. Matched the same way it was
 * asked for, so a pack listing two treatments of one card doesn't hand both
 * refs the same printing; the prefix pass covers double-faced names like
 * "Oko, Lorwyn Liege // …".
 */
function matchCard(data: ScryfallCard[], ref: PackCardRef): ScryfallCard | undefined {
  if (ref.set && ref.collectorNumber) {
    return data.find((c) => c.set === ref.set && c.collector_number === ref.collectorNumber);
  }
  const name = ref.name.toLowerCase();
  return (
    data.find((c) => c.name.toLowerCase() === name) ??
    data.find((c) => c.name.toLowerCase().startsWith(name))
  );
}

/**
 * Key art resolver. Pack definitions use "scryfall-art:<Name>:<set>" so no
 * image URLs need hardcoding; falls back to procedural art offline.
 */
export async function resolveKeyArt(pack: PackDefinition): Promise<string> {
  const spec = pack.keyArt;
  if (spec && !spec.startsWith('scryfall-art:')) return spec;
  if (spec && !FORCE_MOCK) {
    const [, name, set] = spec.split(':');
    try {
      const url = new URL(`${API}/cards/named`);
      url.searchParams.set('exact', name);
      if (set) url.searchParams.set('set', set);
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (res.ok) {
        const card = (await res.json()) as ScryfallCard;
        const art = imageUris(card)?.art_crop;
        if (art) return art;
      }
    } catch {
      /* fall through to mock */
    }
  }
  return mockKeyArt(pack);
}

function imageLoads(src: string, timeoutMs = 6000): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    const t = setTimeout(() => resolve(false), timeoutMs);
    img.onload = () => (clearTimeout(t), resolve(true));
    img.onerror = () => (clearTimeout(t), resolve(false));
    img.src = src;
  });
}

/** Warm the browser cache so reveals don't pop in. */
export function preloadImages(urls: string[]): Promise<void> {
  return Promise.all(urls.map((u) => imageLoads(u, 12000))).then(() => undefined);
}
