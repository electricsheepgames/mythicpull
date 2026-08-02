import type { CardData } from '../data/types';
import { deriveReliefMaps, type ReliefMaps } from '../fx/relief';
import { createReliefSurface, reliefSupported, type ReliefState, type ReliefSurface } from '../fx/reliefRenderer';

/**
 * Builds a 3D card: front (Scryfall image + holo layers) and back. The holo
 * effect is pure CSS driven by custom properties that the tilt loop updates:
 *
 *   --mx / --my   pointer position over the card, in %
 *   --posx/--posy background offset for the rainbow bands, in %
 *   --holo        overall foil intensity 0..1
 *
 * Cards built with `{ relief: true }` additionally get the WebGL relief
 * pipeline layered over the image: depth/normal/roughness maps derived from
 * the card art, lit and displaced by the pointer (see fx/relief.ts). It is
 * opt-in per pack, and every step degrades back to the plain `<img>`.
 */

export interface CardEl {
  root: HTMLDivElement;
  data: CardData;
  /** Feed tilt (deg) + normalized pointer (0..1) into the holo layers. */
  setShine(rx: number, ry: number, px: number, py: number): void;
  /** Relief handle, or null when the card didn't opt in / WebGL2 is missing. */
  relief: ReliefHandle | null;
}

export interface ReliefHandle {
  /**
   * Derive the maps and upload them. Idempotent and safe to call early —
   * resolves false when the pipeline can't run for this card, in which case
   * the plain image stays visible.
   */
  ready(): Promise<boolean>;
  /** Put the shared relief canvas over this card's face. */
  mount(): void;
  unmount(): void;
  render(state: ReliefState): void;
  dispose(): void;
}

export function buildCard(data: CardData, backUrl: string, opts?: { relief?: boolean }): CardEl {
  const root = document.createElement('div');
  root.className = `card3d rarity-${data.rarity}${data.foil ? ' is-foil' : ''}`;

  // Inner flipper so the face-down→face-up rotation composes with the
  // wobble transform applied to the root.
  const flip = document.createElement('div');
  flip.className = 'card-flip';

  const front = document.createElement('div');
  front.className = 'card-face card-front';

  const useRelief = !!opts?.relief && reliefSupported();

  const img = document.createElement('img');
  img.className = 'card-img';
  img.alt = data.name;
  img.draggable = false;
  img.decoding = 'async';
  // The relief pass reads the image back off a canvas and uploads it as a
  // texture — both need CORS. Scryfall's image CDN sends
  // `access-control-allow-origin: *`, and mock art is a data: URL.
  if (useRelief) img.crossOrigin = 'anonymous';
  let imgFailed = false;
  img.src = data.imageLarge;
  img.onerror = () => {
    // Last-resort placeholder so a dead URL never shows a broken image icon.
    imgFailed = true;
    front.classList.add('card-img-failed');
    img.remove();
    const ph = document.createElement('div');
    ph.className = 'card-placeholder';
    ph.textContent = data.name;
    front.prepend(ph);
  };
  front.appendChild(img);

  const shine = document.createElement('div');
  shine.className = 'holo-shine';
  const glare = document.createElement('div');
  glare.className = 'holo-glare';
  front.append(shine, glare);

  const back = document.createElement('div');
  back.className = 'card-face card-back';
  const backImg = document.createElement('img');
  backImg.className = 'card-img';
  backImg.alt = 'Card back';
  backImg.draggable = false;
  backImg.src = backUrl;
  back.appendChild(backImg);

  flip.append(back, front);
  root.appendChild(flip);

  function setShine(rx: number, ry: number, px: number, py: number) {
    const intensity = Math.min(1, (Math.abs(rx) + Math.abs(ry)) / 18);
    root.style.setProperty('--mx', `${(px * 100).toFixed(2)}%`);
    root.style.setProperty('--my', `${(py * 100).toFixed(2)}%`);
    root.style.setProperty('--posx', `${(50 + (px - 0.5) * 90).toFixed(2)}%`);
    root.style.setProperty('--posy', `${(50 + (py - 0.5) * 90).toFixed(2)}%`);
    root.style.setProperty('--holo', (0.25 + intensity * 0.75).toFixed(3));
  }
  setShine(0, 0, 0.5, 0.5);

  const relief = useRelief ? buildReliefHandle(root, front, img, data, () => imgFailed) : null;

  return { root, data, setShine, relief };
}

function buildReliefHandle(
  root: HTMLElement,
  front: HTMLElement,
  img: HTMLImageElement,
  data: CardData,
  failed: () => boolean,
): ReliefHandle {
  let maps: ReliefMaps | null = null;
  let surface: ReliefSurface | null = null;
  let pending: Promise<boolean> | null = null;
  let wantsMount = false;
  let disposed = false;

  async function build(): Promise<boolean> {
    await settled(img);
    if (disposed || failed()) return false;
    const t0 = performance.now();
    maps = deriveReliefMaps(img);
    if (!maps) {
      console.warn(`[relief] could not read "${data.name}" — falling back to the flat image`);
      return false;
    }
    surface = createReliefSurface(img, maps, { foil: data.foil });
    if (!surface) return false;
    root.classList.add('has-relief');
    console.debug(`[relief] "${data.name}" maps derived in ${(performance.now() - t0).toFixed(1)}ms`);
    if (wantsMount) surface.mount(front);
    return true;
  }

  return {
    ready() {
      if (!pending) pending = build();
      return pending;
    },
    mount() {
      wantsMount = true;
      surface?.mount(front);
    },
    unmount() {
      wantsMount = false;
      surface?.unmount();
    },
    render(state) {
      surface?.render(state);
    },
    dispose() {
      disposed = true;
      surface?.dispose();
      surface = null;
      maps = null;
    },
  };
}

/** Resolve once the image has pixels we can read (or immediately, if it failed). */
function settled(img: HTMLImageElement): Promise<void> {
  if (img.complete) return Promise.resolve();
  return new Promise((resolve) => {
    img.addEventListener('load', () => resolve(), { once: true });
    img.addEventListener('error', () => resolve(), { once: true });
  });
}
