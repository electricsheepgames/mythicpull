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
    tagline: 'Tech demo · 34 frame styles',
    accent: '#4fd8ff',
    accentSecondary: '#b061ff',
    keyArt: 'scryfall-art:Shivan Dragon:fdn',
    /*
     * A test bench, not a booster. `fixedContents` pins the list below so the
     * same cards come out in the same order every open, and `relief` routes
     * them through the depth/normal/roughness pipeline.
     *
     * The list is a frame sampler, not a card sampler: it walks every art-window
     * geometry data/artBox.ts knows about — four frame generations, sagas,
     * Class and Case sidebars, a Kamigawa flip, planeswalkers, extended art,
     * showcase treatments, borderless, and full art — so the relief effect can
     * be checked against each in one open. Every entry pins an exact printing
     * by collector number, because the *treatment* is the point and resolving
     * by name alone would hand back whichever printing Scryfall defaults to.
     *
     * Under `?mock=1` these fall back to procedurally drawn cards, which all
     * share one frame — the effect still demos, the style variety doesn't.
     */
    fixedContents: true,
    relief: true,
    demo: true,
    cards: [
      // 1993 and 1997 frames: a narrower, higher art window.
      { name: 'Sorceress Queen', set: 'itp', collectorNumber: '24' },
      { name: 'Power Sink', set: 'rqs', collectorNumber: '11' },
      { name: 'Nowhere to Run', set: 'pw26', collectorNumber: '1' },
      { name: 'Cryptbreaker', set: 'sld', collectorNumber: '839' },
      // 2003 modern frame.
      { name: 'Bellowing Tanglewurm', set: 'plst', collectorNumber: 'SOM-111' },
      { name: 'War Priest of Thune', set: 'plst', collectorNumber: 'M11-38' },
      // M15 frame — the default box, and by far the most common case.
      { name: 'Watery Grave', set: 'trk', collectorNumber: '306' },
      { name: 'Grizzlegom, Hurloon Hero', set: 'mbc', collectorNumber: '39' },
      { name: 'Merciless Executioner', set: 'hoc', collectorNumber: '188' },
      { name: 'Bonecrusher Giant', set: 'plst', collectorNumber: 'ELD-115' },
      { name: 'Darkbore Pathway', set: 'plst', collectorNumber: 'KHM-254' },
      // Windows that move: sagas put the art down the right half, Class and
      // Case mirror it to the left, Kamigawa flips centre it.
      { name: 'Chainer\'s Torment', set: 'dom', collectorNumber: '82' },
      { name: 'Origin of Spider-Man', set: 'spm', collectorNumber: '9' },
      { name: 'Cleric Class', set: 'plst', collectorNumber: 'AFR-6' },
      { name: 'Case of the Locked Hothouse', set: 'mkm', collectorNumber: '155' },
      { name: 'Akki Lavarunner', set: 'chk', collectorNumber: '153' },
      // Planeswalkers: wider window, starts higher.
      { name: 'Liliana, Death\'s Majesty', set: 'drc', collectorNumber: '94' },
      { name: 'Chandra, Novice Pyromancer', set: 'plst', collectorNumber: 'M20-128' },
      // Extended art — the standard window stretched to both card edges.
      { name: 'Burst Lightning', set: 'pw26', collectorNumber: '20' },
      { name: 'Choked Estuary', set: 'msc', collectorNumber: '464' },
      { name: 'M.O.D.O.K.', set: 'msh', collectorNumber: '408' },
      // Showcase frames: wildly different art, same window as the M15 frame.
      { name: 'Farewell', set: 'neo', collectorNumber: '365' },
      { name: 'Olivia, Crimson Bride', set: 'vow', collectorNumber: '315' },
      { name: 'Queza, Augur of Agonies', set: 'snc', collectorNumber: '326' },
      { name: 'Tinybones, the Pickpocket', set: 'otj', collectorNumber: '290' },
      // Borderless: art runs to the trimmed edge, so the window is the card.
      { name: 'Command Tower', set: 'sld', collectorNumber: '2812' },
      { name: 'Captain Kathryn Janeway', set: 'trk', collectorNumber: '1704' },
      { name: 'Arcane Signet', set: 'tle', collectorNumber: '315' },
      { name: 'Berserk', set: 'soa', collectorNumber: '50' },
      { name: 'Jace Beleren', set: 'pspl', collectorNumber: '13' },
      { name: 'Kaito, Bane of Nightmares', set: 'dsk', collectorNumber: '409' },
      // Full art, printed border intact.
      { name: 'Island', set: 'fic', collectorNumber: '479' },
      { name: 'Deep-Cavern Bat', set: 'sch', collectorNumber: '33' },
      // Foil last, so the shader's iridescence closes the demo out — and on a
      // ukiyo-e full art, where it has the whole card to rake across.
      { name: 'Hidetsugu, Devouring Chaos', set: 'neo', collectorNumber: '432', foil: true },
    ],
  },
];

export function getPack(id: string): PackDefinition | undefined {
  return PACKS.find((p) => p.id === id);
}
