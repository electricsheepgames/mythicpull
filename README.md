# MythicPull

A polished, extensible web app for cracking Magic: The Gathering booster packs,
modeled on the pack-opening experience in **Pokémon TCG Pocket**.

## The experience

1. **Pick a set** — a minimal menu with a slowly turning 3D pack preview.
   Ships with the five most recent Magic sets — Marvel Super Heroes (MSH),
   Secrets of Strixhaven (SOS), Teenage Mutant Ninja Turtles (TMT), Lorwyn
   Eclipsed (ECL), and Avatar: The Last Airbender (TLA) — plus a Foundations
   classics sampler. Adding a set is a single registry entry.
2. **Spin the pack** — drag anywhere to rotate the booster a full 360° with
   inertia; it settles back facing you. The foil wrapper's specular sheen
   sweeps across as it turns.
3. **Tear it open** — pull across the perforation line at the top of the pack.
   Sparks trail your finger, the wrapper crackles, and past the threshold the
   strip rips off, the wrapper falls away, and the cards burst out.
4. **Reveal** — cards stack face-down (real card-back art). Tap to flip and
   advance through the pack. Rares and mythics get ray-bursts, glitter and a
   shimmer arpeggio. **Drag anywhere to wobble the current card** like you're
   holding real cardstock — springs, not tweens.
5. **Holo foils** — foil cards (the mythic demo card is always foil) carry a
   rainbow color-dodge holographic layer plus glare that tracks the tilt and
   pointer, in the style of the famous `pokemon-cards-css` effect.
6. **Your pull** — the full pack fans out into a grid with rarity chips; tap
   any card to inspect it in 3D with the full tilt + holo treatment.
7. **Relief Demo** — a fixed 34-card demo pack (badged `DEMO` in the menu)
   that renders each revealed card as a lit surface instead of a flat scan.
   Depth, normal and roughness maps are derived from the card image itself,
   and a WebGL2 shader does relief (parallax-occlusion) mapping plus
   Blinn-Phong shading with a point light that sits wherever the pointer is —
   so moving the mouse both relights the card and physically displaces the
   print. The effect is confined to the printing's **art window**: the frame,
   title bar, text box and border are flat card stock and stay flat, while
   sagas, Class sidebars, extended art, borderless and full-art treatments
   each get their own rectangle (see
   [`src/data/artBox.ts`](src/data/artBox.ts)). A **Maps** button in the
   reveal HUD cycles the shader between the lit result, the raw depth /
   normal / roughness channels, and an art-window overlay. Contents are
   pinned, and the list is a frame sampler — it walks every art-window
   geometry in one open.

All sound is synthesized with WebAudio at runtime (tear crackle, whooshes,
shimmers) — no audio assets. Mouse and touch are both first-class
(pointer events + springs everywhere).

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck + production build
```

**Offline / demo mode:** append `?mock=1` (or just lose network) and the app
procedurally draws placeholder card faces, card back and pack art on canvases —
every interaction works with zero network access.

## Where the art comes from

- **Card fronts** — the [Scryfall API](https://scryfall.com/docs/api), fetched
  at runtime by exact card name via `POST /cards/collection`
  (`image_uris.large`, ~672×936 JPG; `png` at 745×1040 also available).
  No API key required; Scryfall permits hotlinking from its image CDN.
- **Card back** — Scryfall's backs CDN, default `card_back_id`:
  `https://backs.scryfall.io/large/0/a/0aeebaf5-8c7d-4636-9e82-8c27447861f7.jpg`
  (drawn fallback if unreachable).
- **Booster pack art** — the pack is a procedural 3D foil wrapper (front, back,
  crimped seals, side gussets) built around a set's key art
  (Scryfall `art_crop`). For pixel-accurate official packaging, high-res
  booster scans live on the MTG Wiki:
  [Category:Magic booster images](https://mtg.fandom.com/wiki/Category:Magic_booster_images)
  (e.g. `MKM Play Booster.png`, 900×1637) — set `wrapperImage` on a pack
  definition to use one. Wizards' official product shots are also published
  per-set on [magic.wizards.com](https://magic.wizards.com) media pages.

## Extending it

Everything a new set needs lives in `src/data/packs.ts` — one registry entry
with the set code, accent colors, key art, and a card list of real cards
pinned to that set's printing:

```ts
{
  id: 'eoe',
  name: 'Edge of Eternities',
  setCode: 'eoe',
  tagline: 'Play Booster · 14 cards',
  accent: '#4fd8c2',
  accentSecondary: '#7b4dd8',
  keyArt: 'scryfall-art:Sothera, the Supervoid:eoe', // resolved via Scryfall
  wrapperImage: undefined, // optional: official booster scan URL
  cards: [
    { name: 'Some Common', set: 'eoe', rarity: 'common', color: 'U' },
    // … commons → uncommons → rares, money card last:
    { name: 'Face Mythic', set: 'eoe', rarity: 'mythic', color: 'M', foil: true },
  ],
}
```

**See [docs/adding-packs.md](docs/adding-packs.md) for the full
walkthrough** — how to find set codes and exact card names, what the
offline-only `rarity`/`color` hints do, wrapper art options, and how to test
online and offline. Card contents are a fixed list per pack — randomized
slot/rarity generation can replace `fetchPackCards()` in
`src/data/scryfall.ts` without touching any scene code.

### Layout

```
docs/         adding-packs.md — how to add a new set to the registry
scripts/      pack validation + the art-window sampler and report
src/
  data/       pack registry, Scryfall client, offline mock renderer,
              art-window table (which part of a card is the painting)
  components/ 3D card (front/back + holo layers), 3D booster wrapper
  scenes/     menu (pack select), opening (pack → tear → reveal → summary)
  fx/         spring physics + shared ticker, particle canvas, WebAudio sound,
              relief material maps + the WebGL2 surface renderer
  styles/     base/menu/pack/card/reveal CSS (all 3D + holo is pure CSS vars)
```

## Deployment

Pushes to `main` are built and deployed to **GitHub Pages** automatically via
`.github/workflows/deploy.yml`. One-time setup:

1. **Enable Pages via Actions**: repo Settings → Pages → *Build and
   deployment* → Source → **GitHub Actions**. No secrets or tokens needed —
   the workflow uses the repo's built-in `pages: write` permission.
2. **Custom domain (optional)**: Settings → Pages → *Custom domain* → enter
   your domain. GitHub manages the `CNAME` file for you and provisions TLS
   automatically once DNS is pointed at GitHub Pages (an `A`/`AAAA` record
   set, or a `CNAME` record for a subdomain). If you'd rather keep the domain
   on Cloudflare for its CDN/caching, you can proxy the same records through
   Cloudflare (orange-cloud) in front of GitHub Pages — that's an independent
   step and doesn't require anything else in this repo.
3. **Note on `base` path**: `vite.config.ts` has no `base` set, so it
   defaults to `/`, which is correct when the site is served from a domain
   root (a custom domain, or the bare `<username>.github.io`). If you ever
   serve it unmapped at `<username>.github.io/mythicpull/` instead, set
   `base: '/mythicpull/'` in `vite.config.ts`.

After that, every push to `main` redeploys automatically; no server to
manage, and GitHub Pages is free for public repos.

## Disclaimer

Unofficial fan project. Magic: The Gathering is © Wizards of the Coast.
Universes Beyond properties belong to their respective owners (Marvel,
Paramount/Nickelodeon, etc.). Card imagery courtesy of Scryfall. Not
affiliated with or endorsed by WotC or The Pokémon Company.
