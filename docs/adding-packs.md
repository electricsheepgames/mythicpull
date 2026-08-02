# Adding a new pack / set

Everything a pack needs lives in **one entry** in
[`src/data/packs.ts`](../src/data/packs.ts). No scene, component, or style
code has to change — the menu rail, wrapper, reveal flow, and summary grid all
read from the registry.

This guide walks through adding a hypothetical pack for a future set, using
the five current packs (MSH, SOS, TMT, ECL, TLA) as reference implementations.

## 1. The registry entry

```ts
// src/data/packs.ts
{
  id: 'eoe',                        // unique key, used in scene routing
  name: 'Edge of Eternities',       // display name (menu chip + wrapper)
  setCode: 'eoe',                   // Scryfall set code, shown on the chip
  tagline: 'Play Booster · 14 cards',
  accent: '#4fd8c2',                // wrapper foil + ambient glow
  accentSecondary: '#7b4dd8',       // secondary glow / gradient stop
  keyArt: 'scryfall-art:Sothera, the Supervoid:eoe',
  cards: [ /* see step 3 */ ],
}
```

Field notes:

- **`id`** — any unique string; conventionally the set code.
- **`setCode`** — the official 3-letter code. Find it on
  [Scryfall's sets page](https://scryfall.com/sets) (e.g. `ecl` for Lorwyn
  Eclipsed, `tmt` for Teenage Mutant Ninja Turtles). This is what pins card
  printings and resolves key art.
- **`accent` / `accentSecondary`** — pick two colors from the set's branding
  or key art. They drive the procedural wrapper foil, the menu glow, and the
  chip highlight.
- **`comingSoon: true`** — optional; renders the pack as a locked chip in the
  menu (visible but not openable). Handy for announcing the next set before
  its card list is ready — give it `cards: []`.

## 2. Key art and wrapper art

Two options, in increasing order of effort:

1. **`keyArt` (default)** — a `scryfall-art:<Card Name>:<set>` spec. At
   runtime this resolves to that card's `art_crop` via Scryfall's
   `/cards/named` endpoint and gets composited into the procedural 3D foil
   wrapper. Pick the set's face card (the one on the real booster box):
   plain image URLs also work if you have your own art.
2. **`wrapperImage` (pixel-accurate)** — a URL to a full flat booster scan.
   When set, it replaces the procedural wrapper front entirely. High-res
   scans live on the MTG Wiki under
   [Category:Magic booster images](https://mtg.fandom.com/wiki/Category:Magic_booster_images)
   (e.g. `MKM Play Booster.png`, 900×1637).

## 3. The card list

Online, pack contents are **randomized per opening**: each open draws a fresh
rarity-slotted booster from the set's full card pool, fetched via `setCode`
(see [`src/data/booster.ts`](../src/data/booster.ts)). The `cards` list is the
curated **fallback** — it's what opens offline (`?mock=1`) and when Scryfall
is unreachable, and it's revealed **in array order** — so still build it like
cracking a real Play Booster so the drama ramps up:

```
commons → uncommons → rare slot(s) → marquee mythic (foil, last)
```

A realistic 14-card Play Booster skeleton: **6–7 commons, 3–4 uncommons,
1–2 rares, 2–3 mythics**, with the set's face card as the final foil.

```ts
cards: [
  { name: 'Some Common',   set: 'eoe', rarity: 'common',   color: 'W' },
  // ... more commons, then uncommons, then:
  { name: 'Chase Rare',    set: 'eoe', rarity: 'rare',     color: 'R' },
  { name: 'Face Mythic',   set: 'eoe', rarity: 'mythic',   color: 'M', foil: true },
],
```

Per-card fields:

| Field | Required | What it does |
| --- | --- | --- |
| `name` | ✓ | **Exact** Scryfall card name (straight apostrophes, `!` and `,` included). Resolved via `POST /cards/collection`. |
| `set` | – | Pins the printing to a set code so the image *and rarity* come from that set's version. Always set this for real-set packs — rarities shift between printings (e.g. reprints). |
| `foil` | – | Forces the holo/foil treatment. Unset, mythics default to foil. |
| `rarity` | – | **Offline hint only.** Themes the mock card (rarity chip, ray-burst, foil default) when running with `?mock=1` or without network. Online, Scryfall's real rarity always wins. |
| `color` | – | **Offline hint only.** One of `W U B R G M A` (white/blue/black/red/green/multicolor/artifact); themes the mock card frame. Unhinted cards get a stable name-hashed color. |

### Getting names and rarities right

- Copy names verbatim from [Scryfall](https://scryfall.com/sets) — search
  `set:eoe` and sort by rarity. A misspelled name isn't fatal: the card is
  reported in the API's `not_found` list and silently skipped, so the pack
  just comes up one card short.
- Then run `npm run validate:packs` — it catches misspelled names, bad set
  pins, broken key art, and stale rarity hints in one pass (see step 4).
- For double-faced cards, the **front face name** works (e.g.
  `Oko, Lorwyn Liege` resolves `Oko, Lorwyn Liege // Oko, Shadowmoor Scion`).
- Rarity hints don't need to be perfect (they never override Scryfall), but
  accurate ones keep offline mode honest.

## 4. Test it

```bash
npm run validate:packs   # checks every name/set/keyArt against live Scryfall
npm run dev
```

The validator resolves the whole registry through the same Scryfall endpoints
the app uses: it fails on unresolvable names or missing imagery, and warns
when a `rarity` hint disagrees with the card's real rarity. Run it whenever
you touch `packs.ts`.

- **Online** — open the pack twice; you should see real imagery and
  *different* cards each time, commons first and a foil finale last. A
  console warning `[scryfall] booster generation failed` means the set pool
  couldn't be fetched (bad `setCode`, or a set too small to fill 14 slots)
  and the curated list was used; `[scryfall] falling back to mock cards`
  means that fetch failed too. Individually skipped cards in the curated
  path mean a name/set typo.
- **Offline** — append `?mock=1`. The pack should render procedural cards
  with your `rarity`/`color` hints reflected in the frames, rarity chips,
  and which cards get the holo treatment.

`npm run build` typechecks the registry — wrong rarity strings or color
letters fail compilation.

## 5. Fixed-contents and relief demo packs

Three optional flags turn a registry entry into a demo bench rather than a
booster. The `relief` pack in `packs.ts` uses all three:

```ts
fixedContents: true,  // pin `cards`, in order — no booster roll, no shuffle
relief: true,         // render reveals through the WebGL relief pipeline
demo: true,           // DEMO badge on the menu chip
```

- **`fixedContents`** short-circuits both sources of variation: online,
  `fetchPackCards()` skips `generateBooster()` and resolves the curated list
  directly; offline, `mockCardsFor()` skips the within-rarity shuffle. Every
  open yields the same cards in the same order.
- **`relief`** routes each revealed card through
  [`src/fx/relief.ts`](../src/fx/relief.ts) and
  [`src/fx/reliefRenderer.ts`](../src/fx/reliefRenderer.ts): depth, normal
  and roughness maps are derived on the CPU from the card image itself, then
  a WebGL2 shader does relief (parallax-occlusion) mapping plus Blinn-Phong
  shading with a point light parked at the pointer. Moving the mouse relights
  *and* displaces the print; the reveal HUD gains a **Maps** button that
  cycles the shader's output between the lit result and each raw channel.
  Everything degrades to the flat card image if WebGL2 is missing, the image
  is cross-origin without CORS, or map derivation fails.
- **`demo`** is cosmetic — it badges the chip in the menu rail.

Map derivation costs tens of milliseconds per card and runs lazily: the first
two cards are derived under cover of the pack burst, then each flip warms the
next one.

## 6. How randomized contents work

[`src/data/booster.ts`](../src/data/booster.ts) fetches the set's full card
pool once per session (`/cards/search?q=e:<setCode> is:booster -t:basic`,
paginated, cached per set) and rolls a fresh 14-card booster on every open
with Play-Booster-style slots: 7 commons, 3 uncommons, 2 any-rarity
wildcards, 1 rare/mythic (mythic 1-in-7), and a foil finale weighted toward
rare/mythic — no duplicates, revealed commons → mythics with the foil last.
Tweak the odds via the `SLOTS` constant. The scenes only consume the
returned `CardData[]`, so slot changes never touch scene code.
