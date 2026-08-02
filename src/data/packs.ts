import type { PackDefinition } from './types';

/**
 * Pack registry. Adding a pack = adding an entry here — see
 * docs/adding-packs.md for the full walkthrough.
 *
 * The five newest packs mirror the five most recent Magic sets. Online, a
 * pack's contents are NOT this list — every open rolls a fresh rarity-slotted
 * booster from the set's full card pool (see booster.ts), keyed by `setCode`.
 * The `cards` list is the curated fallback used offline (`?mock=1`) and when
 * Scryfall is unreachable: real cards from the set, pinned to the set's
 * printing, ordered like cracking a real Play Booster — commons up front,
 * uncommons next, then the rare slots, with the marquee mythic (always foil)
 * last. `rarity`/`color` are offline hints only — online, Scryfall's actual
 * rarity always wins (see scryfall.ts).
 *
 * Wrapper art: packs render a procedural 3D foil wrapper built around
 * `keyArt` (a Scryfall art_crop). For pixel-accurate official packaging, set
 * `wrapperImage` to a high-res booster scan — the MTG Wiki hosts these at
 * https://mtg.fandom.com/wiki/Category:Magic_booster_images (e.g.
 * "MKM Play Booster.png", 900x1637).
 */
export const PACKS: PackDefinition[] = [
  {
    id: 'msh',
    name: 'Marvel Super Heroes',
    setCode: 'msh',
    tagline: 'Play Booster · 14 cards',
    accent: '#e23636',
    accentSecondary: '#f0b323',
    keyArt: 'scryfall-art:Captain America, Super-Soldier:msh',
    cards: [
      { name: 'Hero in Training', set: 'msh', rarity: 'common', color: 'W' },
      { name: 'Web Up', set: 'msh', rarity: 'common', color: 'W' },
      { name: 'Helicarrier Strike', set: 'msh', rarity: 'common', color: 'U' },
      { name: 'Cruel Alliance', set: 'msh', rarity: 'common', color: 'B' },
      { name: 'HULK SMASH!', set: 'msh', rarity: 'common', color: 'R' },
      { name: 'Dark Deed', set: 'msh', rarity: 'uncommon', color: 'B' },
      { name: 'Justice, Vance Astrovik', set: 'msh', rarity: 'uncommon', color: 'U' },
      { name: 'Madame Masque', set: 'msh', rarity: 'uncommon', color: 'B' },
      { name: 'Ka-Zar of the Savage Land', set: 'msh', rarity: 'uncommon', color: 'G' },
      { name: 'Loki, God of Mischief', set: 'msh', rarity: 'rare', color: 'U' },
      { name: 'Thor, God of Thunder', set: 'msh', rarity: 'mythic', color: 'R' },
      { name: 'Thanos, the Mad Titan', set: 'msh', rarity: 'mythic', color: 'M' },
      { name: 'Captain America, Super-Soldier', set: 'msh', rarity: 'mythic', color: 'W' },
      { name: 'King T\'Challa', set: 'msh', rarity: 'mythic', color: 'M', foil: true },
    ],
  },
  {
    id: 'sos',
    name: 'Secrets of Strixhaven',
    setCode: 'sos',
    tagline: 'Play Booster · 14 cards',
    accent: '#c8a24a',
    accentSecondary: '#7b4dd8',
    keyArt: 'scryfall-art:Lorehold, the Historian:sos',
    cards: [
      { name: 'Ajani\'s Response', set: 'sos', rarity: 'common', color: 'W' },
      { name: 'Last Gasp', set: 'sos', rarity: 'common', color: 'B' },
      { name: 'Goblin Glasswright', set: 'sos', rarity: 'common', color: 'R' },
      { name: 'Unsubtle Mockery', set: 'sos', rarity: 'common', color: 'R' },
      { name: 'Grapple with Death', set: 'sos', rarity: 'common', color: 'M' },
      { name: 'Arcane Omens', set: 'sos', rarity: 'uncommon', color: 'U' },
      { name: 'Snarl Song', set: 'sos', rarity: 'uncommon', color: 'G' },
      { name: 'Sundering Archaic', set: 'sos', rarity: 'uncommon', color: 'A' },
      { name: 'Strixhaven Skycoach', set: 'sos', rarity: 'uncommon', color: 'A' },
      { name: 'Erode', set: 'sos', rarity: 'rare', color: 'W' },
      { name: 'Flashback', set: 'sos', rarity: 'rare', color: 'R' },
      { name: 'Ral Zarek, Guest Lecturer', set: 'sos', rarity: 'mythic', color: 'B' },
      { name: 'Emeritus of Ideation', set: 'sos', rarity: 'mythic', color: 'U' },
      { name: 'Lorehold, the Historian', set: 'sos', rarity: 'mythic', color: 'M', foil: true },
    ],
  },
  {
    id: 'tmt',
    name: 'Teenage Mutant Ninja Turtles',
    setCode: 'tmt',
    tagline: 'Play Booster · 14 cards',
    accent: '#5bbf4a',
    accentSecondary: '#e0812f',
    keyArt: 'scryfall-art:Leonardo, Sewer Samurai:tmt',
    cards: [
      { name: 'Cowabunga!', set: 'tmt', rarity: 'common', color: 'G' },
      { name: 'Mouser Attack!', set: 'tmt', rarity: 'common', color: 'R' },
      { name: 'Pain 101', set: 'tmt', rarity: 'common', color: 'B' },
      { name: 'Stomped by the Foot', set: 'tmt', rarity: 'common', color: 'B' },
      { name: 'Squirrelanoids', set: 'tmt', rarity: 'common', color: 'B' },
      { name: 'Uneasy Alliance', set: 'tmt', rarity: 'common', color: 'W' },
      { name: 'Sewer-veillance Cam', set: 'tmt', rarity: 'common', color: 'A' },
      { name: 'Dimensional Exile', set: 'tmt', rarity: 'uncommon', color: 'W' },
      { name: 'Saved by the Shell', set: 'tmt', rarity: 'uncommon', color: 'G' },
      { name: 'Shredder\'s Technique', set: 'tmt', rarity: 'uncommon', color: 'B' },
      { name: 'Splinter, Radical Rat', set: 'tmt', rarity: 'rare', color: 'M' },
      { name: 'Krang, Utrom Warlord', set: 'tmt', rarity: 'mythic', color: 'M' },
      { name: 'Super Shredder', set: 'tmt', rarity: 'mythic', color: 'B' },
      { name: 'Leonardo, Sewer Samurai', set: 'tmt', rarity: 'mythic', color: 'W', foil: true },
    ],
  },
  {
    id: 'ecl',
    name: 'Lorwyn Eclipsed',
    setCode: 'ecl',
    tagline: 'Play Booster · 14 cards',
    accent: '#8a5ce0',
    accentSecondary: '#e8b34a',
    keyArt: 'scryfall-art:Oko, Lorwyn Liege:ecl',
    cards: [
      { name: 'Changeling Wayfinder', set: 'ecl', rarity: 'common', color: 'A' },
      { name: 'Sun-Dappled Celebrant', set: 'ecl', rarity: 'common', color: 'W' },
      { name: 'Spiral into Solitude', set: 'ecl', rarity: 'common', color: 'W' },
      { name: 'Blight Rot', set: 'ecl', rarity: 'common', color: 'B' },
      { name: 'Reckless Ransacking', set: 'ecl', rarity: 'common', color: 'R' },
      { name: 'Great Forest Druid', set: 'ecl', rarity: 'common', color: 'G' },
      { name: 'Wanderbrine Trapper', set: 'ecl', rarity: 'uncommon', color: 'U' },
      { name: 'Kithkeeper', set: 'ecl', rarity: 'uncommon', color: 'W' },
      { name: 'Silvergill Mentor', set: 'ecl', rarity: 'uncommon', color: 'U' },
      { name: 'Nameless Inversion', set: 'ecl', rarity: 'uncommon', color: 'B' },
      { name: 'Hexing Squelcher', set: 'ecl', rarity: 'rare', color: 'G' },
      { name: 'Bloom Tender', set: 'ecl', rarity: 'mythic', color: 'G' },
      { name: 'Moonshadow', set: 'ecl', rarity: 'mythic', color: 'B' },
      { name: 'Oko, Lorwyn Liege', set: 'ecl', rarity: 'mythic', color: 'M', foil: true },
    ],
  },
  {
    id: 'tla',
    name: 'Avatar: The Last Airbender',
    setCode: 'tla',
    tagline: 'Play Booster · 14 cards',
    accent: '#3fa8d8',
    accentSecondary: '#e0812f',
    keyArt: 'scryfall-art:Avatar Aang:tla',
    cards: [
      { name: 'Aang\'s Journey', set: 'tla', rarity: 'common', color: 'A' },
      { name: 'Zuko\'s Exile', set: 'tla', rarity: 'common', color: 'A' },
      { name: 'Callous Inspector', set: 'tla', rarity: 'common', color: 'B' },
      { name: 'Swampsnare Trap', set: 'tla', rarity: 'common', color: 'B' },
      { name: 'Rowdy Snowballers', set: 'tla', rarity: 'common', color: 'R' },
      { name: 'Azula Always Lies', set: 'tla', rarity: 'common', color: 'R' },
      { name: 'Invasion Submersible', set: 'tla', rarity: 'uncommon', color: 'U' },
      { name: 'Serpent of the Pass', set: 'tla', rarity: 'uncommon', color: 'U' },
      { name: 'Foggy Swamp Spirit Keeper', set: 'tla', rarity: 'uncommon', color: 'M' },
      { name: 'Aang, the Last Airbender', set: 'tla', rarity: 'uncommon', color: 'W' },
      { name: 'Zuko, Conflicted', set: 'tla', rarity: 'rare', color: 'M' },
      { name: 'Koh, the Face Stealer', set: 'tla', rarity: 'mythic', color: 'B' },
      { name: 'Wan Shi Tong, Librarian', set: 'tla', rarity: 'mythic', color: 'U' },
      { name: 'Avatar Aang', set: 'tla', rarity: 'mythic', color: 'M', foil: true },
    ],
  },
  {
    id: 'fdn',
    name: 'Foundations',
    setCode: 'fdn',
    tagline: 'Classics sampler · 14 cards',
    accent: '#d4a843',
    accentSecondary: '#7b4dd8',
    // Shivan Dragon (FDN) art crop — resolved at runtime; see scryfall.ts.
    keyArt: 'scryfall-art:Shivan Dragon:fdn',
    // Iconic-card sampler (default printings, not all from FDN) — kept as the
    // offline demo pack: every name has hand-drawn MOCK_META art in mock.ts.
    cards: [
      { name: 'Llanowar Elves' },
      { name: 'Giant Growth' },
      { name: 'Doom Blade' },
      { name: 'Shock' },
      { name: 'Divination' },
      { name: 'Pacifism' },
      { name: 'Serra Angel' },
      { name: 'Counterspell' },
      { name: 'Lightning Bolt' },
      { name: 'Birds of Paradise' },
      { name: 'Shivan Dragon' },
      { name: 'Wrath of God' },
      { name: 'Sol Ring' },
      // The money card — always last, always foil, demos the holo effect.
      { name: 'Atraxa, Grand Unifier', foil: true },
    ],
  },
  {
    id: 'relief',
    name: 'Relief Demo',
    setCode: 'fdn',
    tagline: 'Tech demo · 8 fixed cards',
    accent: '#4fd8ff',
    accentSecondary: '#b061ff',
    keyArt: 'scryfall-art:Shivan Dragon:fdn',
    // A test bench, not a booster: `fixedContents` pins the list below so the
    // same eight cards come out in the same order every single open, and
    // `relief` routes them through the depth/normal/roughness pipeline. Cards
    // are drawn from the Foundations sampler above (default printings, all
    // with hand-drawn offline art in mock.ts) so the demo behaves identically
    // online and under `?mock=1`.
    fixedContents: true,
    relief: true,
    demo: true,
    cards: [
      { name: 'Llanowar Elves' },
      { name: 'Shock' },
      { name: 'Divination' },
      { name: 'Pacifism' },
      { name: 'Counterspell' },
      { name: 'Serra Angel' },
      { name: 'Shivan Dragon' },
      // Foil last, so the shader's iridescence closes the demo out.
      { name: 'Atraxa, Grand Unifier', foil: true },
    ],
  },
];

export function getPack(id: string): PackDefinition | undefined {
  return PACKS.find((p) => p.id === id);
}
