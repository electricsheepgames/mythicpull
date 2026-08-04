/** Core data model. Deliberately small so new packs/sets bolt on easily. */

import type { ArtBox } from './artBox';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'mythic';

/**
 * Coarse color identity used only by the offline mock renderer to theme
 * procedural card frames: the five colors, M(ulticolor), A(rtifact/colorless).
 */
export type ColorHint = 'W' | 'U' | 'B' | 'R' | 'G' | 'M' | 'A';

export interface CardData {
  /** Scryfall card id when known (mock cards use a synthetic id). */
  id: string;
  name: string;
  setCode: string;
  setName: string;
  rarity: Rarity;
  typeLine: string;
  /** Large-size front image (Scryfall `image_uris.large`, ~672x936). */
  imageLarge: string;
  /** Normal-size front image used while large loads. */
  imageNormal: string;
  /** Whether the reveal should render this card with the holo/foil treatment. */
  foil: boolean;
  /**
   * Where the painting sits inside `imageLarge`, normalized 0..1. Derived from
   * the printing's frame metadata (see artBox.ts) and used by the relief
   * pipeline so the effect stays on the art instead of rippling the frame.
   * Writable, so a card whose frame the classifier reads wrong can be pinned.
   */
  artBox: ArtBox;
}

export interface PackDefinition {
  id: string;
  /** Display name of the pack, e.g. the set name. */
  name: string;
  setCode: string;
  tagline: string;
  /** Accent colors used for wrapper foil + ambient glow. */
  accent: string;
  accentSecondary: string;
  /**
   * Key art shown in the wrapper's art window. Any hotlinkable image works;
   * Scryfall `art_crop` URLs are ideal.
   */
  keyArt?: string;
  /**
   * Optional: full flat wrapper art (e.g. an official booster scan such as the
   * high-res pack images hosted on the MTG Wiki, mtg.fandom.com
   * "Category:Magic booster images"). When set, it replaces the procedural
   * wrapper front.
   */
  wrapperImage?: string;
  /**
   * Curated fallback contents, resolved by exact name (+ optional set)
   * against Scryfall `/cards/collection`. Online, opens are randomized from
   * the set's full pool instead (see booster.ts); this list is what you get
   * offline (`?mock=1`) or when Scryfall is unreachable. Build it like a real
   * booster: commons first, money card last.
   */
  cards: PackCardRef[];
  /** Future packs render in the menu but can't be opened yet. */
  comingSoon?: boolean;
  /**
   * Pin the contents to `cards`, in order. Skips the randomized booster roll
   * (booster.ts) and the offline shuffle, so every open of this pack shows
   * exactly the same cards in exactly the same sequence — what a demo needs.
   */
  fixedContents?: boolean;
  /**
   * Render revealed cards through the relief pipeline: normal/depth/roughness
   * maps derived from each card image (fx/relief.ts), lit and displaced by the
   * pointer in WebGL (fx/reliefRenderer.ts). Degrades to the flat card image
   * wherever WebGL2 or CORS isn't available.
   */
  relief?: boolean;
  /** Flags the pack as a tech demo in the menu rail. */
  demo?: boolean;
}

export interface PackCardRef {
  name: string;
  /** Pin a specific printing; otherwise Scryfall returns the default one. */
  set?: string;
  /**
   * Pin an exact printing within `set` by collector number. Needed whenever
   * the *treatment* matters and not just the card — a set's showcase,
   * borderless and extended-art versions all share one name, and resolving by
   * name alone returns whichever printing Scryfall considers the default.
   * Requires `set`.
   */
  collectorNumber?: string;
  /** Force the foil/holo treatment on this card. */
  foil?: boolean;
  /**
   * Rarity hint for offline mock mode (`?mock=1`). Online, Scryfall's real
   * rarity always wins — this only themes the procedurally drawn stand-in so
   * rarity chips, ray-bursts and foil defaults still make sense offline.
   */
  rarity?: Rarity;
  /** Color hint for offline mock mode; themes the drawn card frame. */
  color?: ColorHint;
}
