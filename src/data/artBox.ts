/**
 * Where the artwork lives on a card face.
 *
 * Effects that are meant to act on the *painting* — the relief pipeline in
 * fx/relief.ts is the first — need to know which part of the card image is art
 * and which part is printed frame, title bar, text box and border. Embossing
 * the frame makes flat card stock ripple; embossing the art is the point.
 *
 * Magic has no single answer, so this module maps a card's frame metadata to a
 * normalized rectangle (0..1 of the card image, +y down). The numbers are not
 * guesses: they were recovered by locating each card's Scryfall `art_crop`
 * inside its own full-card image by normalized cross-correlation, over a
 * stratified sample of 132 printings spanning every frame generation and
 * special treatment in `scripts/art-box-sample.mjs`. Clusters came out tight —
 * the widest spread inside a family was 0.006 of the card width — because
 * Scryfall crops from a small set of per-frame presets, which are exactly the
 * frame geometries we're after.
 *
 * Run `node scripts/art-box-sample.mjs` to re-derive the table, and
 * `node scripts/art-box-report.mjs` to render the current table over real card
 * images as a contact sheet.
 */

/** Normalized rect within the card image: origin top-left, +y down. */
export interface ArtBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The Scryfall fields that determine a card's frame geometry. */
export interface FrameInfo {
  /** Scryfall `layout`: normal, saga, class, case, flip, adventure, … */
  layout?: string;
  /** Scryfall `frame`: '1993' | '1997' | '2003' | '2015' | 'future'. */
  frame?: string;
  /** Scryfall `frame_effects`: extendedart, showcase, inverted, … */
  frameEffects?: string[];
  /** Scryfall `border_color`: black | white | borderless | silver | gold. */
  borderColor?: string;
  /** Scryfall `full_art` — the printing has no conventional art window. */
  fullArt?: boolean;
  /** Front-face type line, used only to spot planeswalkers. */
  typeLine?: string;
}

/**
 * The measured presets. Every value is the median of its cluster; see the
 * module comment for provenance.
 */
export const ART_BOXES = {
  /** M15 frame (2015-) and every showcase treatment built on its window. */
  standard: { x: 0.079, y: 0.114, w: 0.841, h: 0.44 },
  /** Modern frame, 2003–2014. Marginally narrower window, sits lower. */
  frame2003: { x: 0.086, y: 0.118, w: 0.828, h: 0.436 },
  /** Classic frame, 1997–2002 (and today's retro reprints). */
  frame1997: { x: 0.118, y: 0.1, w: 0.766, h: 0.443 },
  /** Original 1993 frame — a touch wider and higher than 1997. */
  frame1993: { x: 0.114, y: 0.095, w: 0.779, h: 0.449 },
  /**
   * Planeswalkers: window is wider and starts higher to leave room for loyalty
   * abilities. Two heights exist in the wild — 0.449 and 0.382, depending on
   * how much room the ability box needs — and nothing in the metadata tells
   * them apart, so this splits the difference. The residual error either way
   * is about one edge-feather wide, which is where it stops being visible.
   */
  planeswalker: { x: 0.073, y: 0.102, w: 0.849, h: 0.415 },
  /** Sagas: tall art down the right half, chapter abilities on the left. */
  saga: { x: 0.502, y: 0.114, w: 0.418, h: 0.723 },
  /** Class and Case cards: the saga layout mirrored — tall art on the left. */
  sidebarLeft: { x: 0.075, y: 0.113, w: 0.418, h: 0.723 },
  /** Kamigawa-style flip cards: one art window centred between two text halves. */
  flip: { x: 0.084, y: 0.314, w: 0.83, h: 0.344 },
  /** Extended art: the standard window stretched to both card edges. */
  extendedArt: { x: 0, y: 0.12, w: 1, h: 0.443 },
  /**
   * Borderless printings whose painting is the entire card — full-art
   * treatments, and planeswalkers, whose loyalty abilities float on top of the
   * art rather than sitting in a panel below it. The only thing to keep out of
   * is the rounded corner.
   */
  fullBleedBorderless: { x: 0.012, y: 0.009, w: 0.976, h: 0.982 },
  /**
   * Ordinary borderless printings: the art bleeds to the left, right and top
   * edges but still stops at an opaque type line, with rules text under it.
   * Ends where the M15 frame puts its type bar.
   */
  fullBleedUpper: { x: 0.012, y: 0.009, w: 0.976, h: 0.546 },
  /**
   * Full-art printings that kept a printed border (full-art basics, ukiyo-e
   * and similar showcases): everything inside the border is painting.
   */
  fullBleedBordered: { x: 0.04, y: 0.029, w: 0.92, h: 0.942 },
} as const satisfies Record<string, ArtBox>;

/** Used when nothing is known about the card — the modern frame's window. */
export const DEFAULT_ART_BOX: ArtBox = ART_BOXES.standard;

/**
 * Pick the art rectangle for a printing.
 *
 * Ordering matters. Full-bleed treatments are checked first because they
 * override whatever frame the card would otherwise wear: a borderless saga is
 * a painting with chapter numbers on top of it, not a saga frame. After that
 * it's layout (which moves the window), then planeswalkers, then extended art
 * (which only widens it), then the frame generation.
 *
 * Known imperfections, kept deliberately rather than special-cased:
 *  - `full_art` is a printing flag, not a promise about the painting. A
 *    handful of showcase frames set it while still drawing a real art window
 *    (TMT's silver-frame legends), and a few keep a text panel below the art
 *    (the EOE station lands); those get more relief than they should. It is
 *    right for roughly four in five of the sampled full-art printings.
 *  - A few modern sagas (Star Trek, the Marvel comic-panel ones) put their art
 *    across the top instead of down the right side, and nothing in the card's
 *    metadata distinguishes them. They get the right-side box.
 *  - Split and aftermath cards have two art windows; they fall through to the
 *    standard box, which covers the upper one.
 * `CardData.artBox` is writable, so any specific card can be pinned by hand.
 */
export function artBoxFor(info: FrameInfo): ArtBox {
  const effects = info.frameEffects ?? [];
  const planeswalker = /planeswalker/i.test(info.typeLine ?? '');

  if (info.borderColor === 'borderless') {
    return info.fullArt || planeswalker ? ART_BOXES.fullBleedBorderless : ART_BOXES.fullBleedUpper;
  }
  if (info.fullArt) return ART_BOXES.fullBleedBordered;

  switch (info.layout) {
    case 'saga':
      return ART_BOXES.saga;
    case 'class':
    case 'case':
      return ART_BOXES.sidebarLeft;
    case 'flip':
      return ART_BOXES.flip;
  }

  if (planeswalker) return ART_BOXES.planeswalker;
  if (effects.includes('extendedart')) return ART_BOXES.extendedArt;

  switch (info.frame) {
    case '1993':
      return ART_BOXES.frame1993;
    case '1997':
      return ART_BOXES.frame1997;
    case '2003':
      return ART_BOXES.frame2003;
  }
  return ART_BOXES.standard;
}

/** Clamp a box into the card and refuse degenerate rects. */
export function normalizeArtBox(box: ArtBox): ArtBox {
  const x = clamp01(box.x);
  const y = clamp01(box.y);
  return {
    x,
    y,
    w: Math.max(0.05, Math.min(1 - x, box.w)),
    h: Math.max(0.05, Math.min(1 - y, box.h)),
  };
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
