import type { Scene } from '../main';
import type { CardData, PackDefinition } from '../data/types';
import { fetchPackCards, getCardBack, resolveKeyArt, preloadImages } from '../data/scryfall';
import { buildPack } from '../components/wrapper';
import { buildCard, type CardEl } from '../components/card';
import { Spring, onTick } from '../fx/spring';
import { burst, rainbowBurst, tearSparks } from '../fx/particles';
import { tearCrackle, ripOpen, cardWhoosh, flipSnap, rareShimmer, uiBlip } from '../fx/sound';
import { RELIEF_DEBUG_MODES, reliefSupported, setReliefDebug, type ReliefDebug } from '../fx/reliefRenderer';

/**
 * The pack-cracking ritual, in four phases:
 *
 *  pack    — the booster floats center stage; drag to spin it 360°, then
 *            swipe across the perforation line at the top to tear it open
 *  burst   — the strip rips off, the wrapper falls away, the cards rise
 *  reveal  — tap through the stack one card at a time; drag anywhere to
 *            wobble the current card (holo foils shimmer with the tilt)
 *  summary — the full pull fans out; tap any card to inspect it in 3D
 *
 * Packs flagged `relief` add one more layer: each revealed card is rendered
 * through the WebGL relief pipeline (fx/relief.ts + fx/reliefRenderer.ts),
 * lit and displaced by the pointer, with a map inspector in the reveal HUD.
 */

type Phase = 'pack' | 'burst' | 'reveal' | 'summary';

const TEAR_ZONE = 0.2; // top fraction of the pack that accepts tear gestures
const TEAR_COMPLETE = 0.88;
const TAP_MAX_DIST = 9;
const TAP_MAX_MS = 350;

export function openingScene(opts: {
  pack: PackDefinition;
  onExit: () => void;
  onAgain: () => void;
}): Scene {
  const { pack } = opts;
  const el = document.createElement('section');
  el.className = 'scene opening-scene phase-pack';
  el.style.setProperty('--accent', pack.accent);
  el.style.setProperty('--accent2', pack.accentSecondary);
  el.innerHTML = `
    <header class="open-head">
      <button class="btn-icon back-btn" title="Back to packs">←</button>
      <div class="open-title">${pack.name}</div>
      <div class="open-counter"></div>
    </header>
    <div class="pack-stage">
      <div class="pack-shadow"></div>
      <div class="pack-float"><div class="pack-mount"></div></div>
      <div class="stack-zone"></div>
      <div class="open-flash"></div>
      <div class="rare-rays"></div>
    </div>
    <div class="hint hint-spin">Drag to spin the pack</div>
    <div class="hint hint-tear">Pull across the top to tear it open</div>
    <div class="reveal-hud">
      <p class="relief-note">Depth · normal · roughness derived from the card art — move the pointer to relight and displace the print.</p>
      <div class="hud-row">
        <button class="btn btn-ghost maps-btn">Maps: Lit</button>
        <button class="btn btn-ghost skip-btn">Reveal all</button>
      </div>
    </div>
    <div class="summary-panel">
      <h2 class="summary-title">Your pull</h2>
      <div class="summary-rarities"></div>
      <div class="summary-grid"></div>
      <div class="summary-actions">
        <button class="btn btn-primary again-btn">Open another</button>
        <button class="btn btn-ghost exit-btn">Change pack</button>
      </div>
    </div>
    <div class="inspect-overlay"><div class="inspect-mount"></div></div>
  `;

  const packStage = el.querySelector<HTMLDivElement>('.pack-stage')!;
  const packFloat = el.querySelector<HTMLDivElement>('.pack-float')!;
  const packMount = el.querySelector<HTMLDivElement>('.pack-mount')!;
  const stackZone = el.querySelector<HTMLDivElement>('.stack-zone')!;
  const counter = el.querySelector<HTMLDivElement>('.open-counter')!;
  const flash = el.querySelector<HTMLDivElement>('.open-flash')!;
  const rays = el.querySelector<HTMLDivElement>('.rare-rays')!;

  let phase: Phase = 'pack';
  let disposed = false;
  const cleanups: (() => void)[] = [];

  /* The relief demo. Gated on the pack flag and on WebGL2 actually being
     there — without it every card just stays a flat image. */
  const useRelief = !!pack.relief && reliefSupported();
  if (useRelief) el.classList.add('relief-pack');
  setReliefDebug('lit');

  function setPhase(p: Phase) {
    el.classList.remove(`phase-${phase}`);
    phase = p;
    el.classList.add(`phase-${phase}`);
  }

  /* ------------------------------------------------------------------ */
  /* Data: kick everything off immediately; the tear waits on nothing    */
  /* visible — cards resolve while the user plays with the pack.         */
  /* ------------------------------------------------------------------ */

  let cards: CardData[] = [];
  let cardBack = '';
  const dataReady = (async () => {
    const [fetched, back] = await Promise.all([fetchPackCards(pack), getCardBack()]);
    cards = fetched;
    cardBack = back;
    void preloadImages([back, ...fetched.map((c) => c.imageNormal)]);
  })();

  /* ------------------------------------------------------------------ */
  /* Phase 1 — the pack: spin + tear                                     */
  /* ------------------------------------------------------------------ */

  let packEl: ReturnType<typeof buildPack> | null = null;
  let rotY = 0;
  let spinVel = 0;
  const tiltX = new Spring(0, 120, 12);

  void resolveKeyArt(pack).then((art) => {
    if (disposed) return;
    packEl = buildPack(pack, art);
    packMount.appendChild(packEl.root);
    packEl.root.classList.add('pack-arrive');
    requestAnimationFrame(() => packEl?.root.classList.remove('pack-arrive'));
  });

  interface Drag {
    id: number;
    mode: 'spin' | 'tear';
    startX: number;
    startY: number;
    lastX: number;
    lastT: number;
    moved: boolean;
    /** Tear direction, locked from the first horizontal movement. */
    tearDir?: 1 | -1;
  }
  let drag: Drag | null = null;
  let tearProgress = 0;
  let tearRtl = false;
  let torn = false;
  let lastCrackle = 0;

  function packRect(): DOMRect | null {
    return packEl ? packEl.front.getBoundingClientRect() : null;
  }

  function frontFacing(): boolean {
    const n = ((rotY % 360) + 360) % 360;
    return n < 40 || n > 320;
  }

  function onPackDown(e: PointerEvent) {
    if (phase !== 'pack' || torn || !packEl) return;
    const rect = packRect();
    let mode: Drag['mode'] = 'spin';
    if (
      rect &&
      frontFacing() &&
      e.clientY > rect.top - 20 &&
      e.clientY < rect.top + rect.height * TEAR_ZONE &&
      e.clientX > rect.left - 30 &&
      e.clientX < rect.right + 30
    ) {
      mode = 'tear';
      // settle the pack square while tearing
      rotY = Math.round(rotY / 360) * 360;
      applyPackTransform();
    }
    drag = { id: e.pointerId, mode, startX: e.clientX, startY: e.clientY, lastX: e.clientX, lastT: performance.now(), moved: false };
    packStage.setPointerCapture(e.pointerId);
    el.classList.add(mode === 'tear' ? 'is-tearing' : 'is-spinning');
  }

  function onPackMove(e: PointerEvent) {
    if (phase !== 'pack' || !drag || e.pointerId !== drag.id || !packEl) return;
    const dx = e.clientX - drag.lastX;
    const now = performance.now();
    if (Math.abs(e.clientX - drag.startX) + Math.abs(e.clientY - drag.startY) > 4) drag.moved = true;

    if (drag.mode === 'spin') {
      rotY += dx * 0.55;
      const dt = Math.max(now - drag.lastT, 1);
      spinVel = (dx * 0.55) / (dt / 1000);
      tiltX.target = clamp((e.clientY - drag.startY) * -0.05, -10, 10);
      applyPackTransform();
    } else {
      const rect = packRect();
      if (!rect) return;
      // Lock the tear direction from the first real horizontal movement,
      // then let the frontier track the pointer directly: the wrapper opens
      // exactly as far as the finger has travelled — no stretch, and a slow
      // drag tears slowly. Perforations don't heal, so progress only grows.
      if (!drag.tearDir) {
        if (Math.abs(e.clientX - drag.startX) < 6) return;
        const dir: 1 | -1 = e.clientX > drag.startX ? 1 : -1;
        // A tear must sweep inward from where it was grabbed. If the grab
        // point sits in the far half for this direction (e.g. grabbing the
        // left edge and tugging further left), `along` would start near 1
        // and rip the pack open instantly — treat that gesture as a spin.
        const grabAlong =
          dir === 1
            ? (drag.startX - rect.left) / rect.width
            : (rect.right - drag.startX) / rect.width;
        if (grabAlong > 0.5) {
          drag.mode = 'spin';
          el.classList.remove('is-tearing');
          el.classList.add('is-spinning');
          drag.lastX = e.clientX;
          drag.lastT = now;
          return;
        }
        drag.tearDir = dir;
        tearRtl = dir === -1;
      }
      const along =
        drag.tearDir === 1
          ? (e.clientX - rect.left) / rect.width
          : (rect.right - e.clientX) / rect.width;
      const t = clamp(along, 0, 1);
      if (t > tearProgress) {
        tearProgress = t;
        renderTear(tearRtl);
        if (now - lastCrackle > 55 && Math.abs(dx) > 1.5) {
          lastCrackle = now;
          tearCrackle(tearProgress);
          const frontierX = drag.tearDir === 1 ? tearProgress : 1 - tearProgress;
          tearSparks(
            rect.left + frontierX * rect.width,
            rect.top + rect.height * 0.17,
            drag.tearDir === 1 ? -0.4 : Math.PI + 0.4,
          );
        }
      }
      if (tearProgress >= TEAR_COMPLETE) {
        finishTear();
        return;
      }
    }
    drag.lastX = e.clientX;
    drag.lastT = now;
  }

  function onPackUp(e: PointerEvent) {
    if (!drag || e.pointerId !== drag.id) return;
    const wasTear = drag.mode === 'tear';
    drag = null;
    el.classList.remove('is-tearing', 'is-spinning');
    tiltX.target = 0;
    if (wasTear && !torn) {
      // sprang back — didn't tear far enough
      const settle = () => {
        tearProgress = Math.max(0, tearProgress - 0.06);
        renderTear(tearRtl);
        if (tearProgress > 0 && !torn && !disposed) requestAnimationFrame(settle);
      };
      settle();
    }
  }

  function renderTear(rtl: boolean) {
    if (!packEl) return;
    const p = tearProgress;
    packEl.root.style.setProperty('--tear', p.toFixed(4));
    packEl.root.classList.toggle('tear-rtl', rtl);
    packEl.root.classList.toggle('tearing', p > 0.01);
    // micro-shake sells the resistance
    const shake = p > 0.05 ? (Math.random() - 0.5) * p * 5 : 0;
    packFloat.style.setProperty('--shake', `${shake.toFixed(2)}px`);
  }

  function applyPackTransform() {
    if (!packEl) return;
    packEl.root.style.transform = `rotateY(${rotY.toFixed(2)}deg) rotateX(${tiltX.value.toFixed(2)}deg)`;
    packEl.setSpin(rotY);
  }

  // pack physics loop: inertia + snap-to-front + idle sway
  cleanups.push(
    onTick((dt, now) => {
      if (phase !== 'pack' || !packEl) return;
      tiltX.step(dt);
      if (!drag) {
        if (Math.abs(spinVel) > 20) {
          rotY += spinVel * dt;
          spinVel *= Math.exp(-2.2 * dt);
        } else {
          spinVel = 0;
          // ease home to the nearest full turn, plus a gentle idle sway
          const home = Math.round(rotY / 360) * 360;
          rotY += (home - rotY) * Math.min(1, dt * 4);
          if (!torn && Math.abs(home - rotY) < 1) {
            rotY = home + Math.sin(now / 900) * 2.4;
          }
        }
      }
      applyPackTransform();
    }),
  );

  async function finishTear() {
    if (torn || !packEl) return;
    torn = true;
    drag = null;
    el.classList.remove('is-tearing');
    packEl.root.classList.remove('tearing');
    ripOpen();
    const rect = packRect();
    if (rect) {
      burst(rect.left + rect.width / 2, rect.top + rect.height * 0.16, {
        count: 50,
        speed: 420,
        spread: Math.PI,
        angle: -Math.PI / 2,
        gravity: 520,
        size: 5,
        life: 1.1,
      });
    }
    packEl.root.classList.add('torn');
    setPhase('burst');
    await dataReady;
    if (disposed) return;
    buildStack();
    flash.classList.add('go');
    setTimeout(() => {
      if (disposed) return;
      el.classList.add('pack-away');
      revealStack();
    }, 420);
  }

  /* ------------------------------------------------------------------ */
  /* Phase 3 — reveal: the stack                                         */
  /* ------------------------------------------------------------------ */

  const cardEls: CardEl[] = [];
  let currentIdx = -1; // index into cardEls of the face-up card
  let flipped = false; // is the top card face-up yet?
  let inputLock = 0;
  const wobX = new Spring(0, 150, 9);
  const wobY = new Spring(0, 150, 9);
  let pointerNorm = { x: 0.5, y: 0.5 };
  /* Same pointer, unclamped: the relief light keeps travelling once the
     cursor leaves the card, which is what sells it as a lamp in the room. */
  let lightNorm = { x: 0.5, y: 0.35 };
  /* Crossfade from the flat scan to the lit surface as a card turns over. */
  let reliefFade = 0;

  function buildStack() {
    for (let i = 0; i < cards.length; i++) {
      const c = buildCard(cards[i], cardBack, { relief: useRelief });
      c.root.classList.add('in-stack', 'face-down');
      const depth = i; // 0 = top of stack
      c.root.style.setProperty('--depth', String(depth));
      c.root.style.setProperty('--jit', `${seededJitter(cards[i].id + i)}deg`);
      c.root.style.zIndex = String(cards.length - i);
      stackZone.appendChild(c.root);
      cardEls.push(c);
    }
    // Derive the first two cards' maps now, under cover of the burst — a few
    // tens of ms of CPU each, and the worst possible moment to spend them is
    // the instant a card turns over.
    if (useRelief) {
      void cardEls[0]?.relief?.ready();
      setTimeout(() => cardEls[1]?.relief?.ready(), 150);
    }
  }

  function revealStack() {
    setPhase('reveal');
    currentIdx = 0;
    counter.textContent = `1 / ${cards.length}`;
    stackZone.classList.add('risen');
    attachRevealInput();
  }

  function currentCard(): CardEl | null {
    return cardEls[currentIdx] ?? null;
  }

  function flipCurrent() {
    const c = currentCard();
    if (!c) return;
    flipped = true;
    flipSnap();
    c.root.classList.remove('face-down');
    if (useRelief) {
      reliefFade = 0;
      c.relief?.mount();
      void c.relief?.ready();
      // Derive the next card's maps now, while this one is being admired —
      // a few ms of CPU that would otherwise land on the flip.
      void cardEls[currentIdx + 1]?.relief?.ready();
    }
    // Inline animation so it wins over (and then permanently clears) the
    // card-rise fill — otherwise the rise would replay when a class-based
    // animation is removed, and its forwards-fill would block the wobble
    // transform below.
    c.root.style.animation = 'flip-pop 0.6s ease-out';
    setTimeout(() => {
      if (!c.root.classList.contains('fly-off')) c.root.style.animation = 'none';
    }, 650);
    const rare = c.data.rarity === 'rare' || c.data.rarity === 'mythic';
    if (rare) {
      inputLock = performance.now() + 550;
      rareShimmer();
      rays.classList.add('go');
      rays.style.setProperty('--ray-hue', c.data.rarity === 'mythic' ? '28' : '46');
      setTimeout(() => rays.classList.remove('go'), 1600);
      const r = c.root.getBoundingClientRect();
      rainbowBurst(r.left + r.width / 2, r.top + r.height / 2, c.data.rarity === 'mythic' ? 110 : 60);
    }
  }

  function advance() {
    const c = currentCard();
    if (!c) return;
    flipped = false;
    cardWhoosh();
    c.root.style.animation = ''; // hand control back to the fly-off class
    c.root.classList.add('fly-off');
    c.root.style.setProperty('--fly-rot', `${(Math.random() * 24 - 12).toFixed(1)}deg`);
    // Hand the shared relief canvas back before the card flies off, then let
    // its textures go with it.
    c.relief?.unmount();
    setTimeout(() => {
      c.root.remove();
      c.relief?.dispose();
    }, 700);
    currentIdx++;
    wobX.snap(0);
    wobY.snap(0);
    if (currentIdx >= cardEls.length) {
      counter.textContent = '';
      setTimeout(showSummary, 350);
      return;
    }
    counter.textContent = `${currentIdx + 1} / ${cards.length}`;
    setTimeout(() => {
      if (!disposed && phase === 'reveal' && !flipped) flipCurrent();
    }, 120);
  }

  function onRevealTap() {
    if (performance.now() < inputLock) return;
    if (!flipped) {
      flipCurrent();
    } else {
      advance();
    }
  }

  interface RevealDrag {
    id: number;
    startX: number;
    startY: number;
    startT: number;
    moved: boolean;
  }
  let rDrag: RevealDrag | null = null;

  function attachRevealInput() {
    const down = (e: PointerEvent) => {
      if (phase !== 'reveal') return;
      rDrag = { id: e.pointerId, startX: e.clientX, startY: e.clientY, startT: performance.now(), moved: false };
      packStage.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (phase !== 'reveal') return;
      const c = currentCard();
      if (!c) return;
      const r = c.root.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width;
      const ny = (e.clientY - r.top) / r.height;
      pointerNorm = { x: clamp(nx, 0, 1), y: clamp(ny, 0, 1) };
      lightNorm = { x: nx, y: ny };
      if (rDrag && e.pointerId === rDrag.id) {
        const dx = e.clientX - rDrag.startX;
        const dy = e.clientY - rDrag.startY;
        if (Math.abs(dx) + Math.abs(dy) > TAP_MAX_DIST) rDrag.moved = true;
        // drag = wobble the card like you're holding it
        wobY.target = clamp(dx * 0.09, -16, 16);
        wobX.target = clamp(-dy * 0.09, -14, 14);
      } else if (e.pointerType === 'mouse') {
        // hover: subtle follow
        wobY.target = (pointerNorm.x - 0.5) * 8;
        wobX.target = (0.5 - pointerNorm.y) * 7;
      }
    };
    const up = (e: PointerEvent) => {
      if (!rDrag || e.pointerId !== rDrag.id) return;
      const wasTap = !rDrag.moved && performance.now() - rDrag.startT < TAP_MAX_MS;
      rDrag = null;
      wobX.target = 0;
      wobY.target = 0;
      // release wobble — the card sloshes back like cardstock
      wobX.impulse(wobX.value * -6);
      wobY.impulse(wobY.value * -6);
      if (wasTap && phase === 'reveal') onRevealTap();
    };
    packStage.addEventListener('pointerdown', down);
    packStage.addEventListener('pointermove', move);
    packStage.addEventListener('pointerup', up);
    packStage.addEventListener('pointercancel', up);
    cleanups.push(() => {
      packStage.removeEventListener('pointerdown', down);
      packStage.removeEventListener('pointermove', move);
      packStage.removeEventListener('pointerup', up);
      packStage.removeEventListener('pointercancel', up);
    });
  }

  // reveal tilt loop
  cleanups.push(
    onTick((dt, now) => {
      if (phase !== 'reveal') return;
      const c = currentCard();
      if (!c || !flipped) return;
      wobX.step(dt);
      wobY.step(dt);
      const idleX = rDrag ? 0 : Math.sin(now / 1300) * 1.2;
      const idleY = rDrag ? 0 : Math.cos(now / 1700) * 1.6;
      const rx = wobX.value + idleX;
      const ry = wobY.value + idleY;
      // translateZ lifts the held card off the stack so its tilted plane
      // can't intersect (and slice through) the card behind it
      c.root.style.transform = `translateZ(34px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
      c.setShine(rx, ry, pointerNorm.x, pointerNorm.y);
      if (c.relief) {
        reliefFade = Math.min(1, reliefFade + dt * 2.8);
        c.relief.render({
          tiltX: rx,
          tiltY: ry,
          lightU: lightNorm.x,
          lightV: lightNorm.y,
          intensity: reliefFade,
        });
      }
    }),
  );

  /* ------------------------------------------------------------------ */
  /* Phase 4 — summary fan                                               */
  /* ------------------------------------------------------------------ */

  const summaryPanel = el.querySelector<HTMLDivElement>('.summary-panel')!;
  const summaryGrid = el.querySelector<HTMLDivElement>('.summary-grid')!;
  const summaryRar = el.querySelector<HTMLDivElement>('.summary-rarities')!;
  const inspectOverlay = el.querySelector<HTMLDivElement>('.inspect-overlay')!;
  const inspectMount = el.querySelector<HTMLDivElement>('.inspect-mount')!;

  function showSummary() {
    setPhase('summary');
    uiBlip();
    const counts: Record<string, number> = {};
    for (const c of cards) counts[c.rarity] = (counts[c.rarity] ?? 0) + 1;
    summaryRar.innerHTML = (['mythic', 'rare', 'uncommon', 'common'] as const)
      .filter((r) => counts[r])
      .map((r) => `<span class="rar-chip rar-${r}">${counts[r]} ${r}</span>`)
      .join('');
    summaryGrid.innerHTML = '';
    cards.forEach((c, i) => {
      const cell = document.createElement('button');
      cell.className = `summary-card rarity-${c.rarity}${c.foil ? ' is-foil' : ''}`;
      cell.style.setProperty('--i', String(i));
      const img = document.createElement('img');
      img.src = c.imageNormal;
      img.alt = c.name;
      img.draggable = false;
      cell.appendChild(img);
      cell.addEventListener('click', () => inspect(c));
      summaryGrid.appendChild(cell);
    });
    summaryPanel.classList.add('show');
  }

  /* Inspect: a single card with the full tilt + holo treatment. */
  let inspectCleanup: (() => void) | null = null;

  function inspect(data: CardData) {
    uiBlip();
    inspectCleanup?.();
    inspectCleanup = null;
    inspectMount.innerHTML = '';
    const c = buildCard(data, cardBack, { relief: useRelief });
    c.root.classList.add('inspect-card');
    inspectMount.appendChild(c.root);
    c.relief?.mount();
    void c.relief?.ready();
    inspectOverlay.classList.add('show');
    const sx = new Spring(0, 150, 10);
    const sy = new Spring(0, 150, 10);
    let norm = { x: 0.5, y: 0.5 };
    let light = { x: 0.5, y: 0.3 };
    let down = false;
    const onMove = (e: PointerEvent) => {
      const r = c.root.getBoundingClientRect();
      light = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
      norm = { x: clamp(light.x, 0, 1), y: clamp(light.y, 0, 1) };
      const scale = down || e.pointerType !== 'mouse' ? 1 : 0.55;
      sy.target = (norm.x - 0.5) * 30 * scale;
      sx.target = (0.5 - norm.y) * 24 * scale;
    };
    const onDown = (e: PointerEvent) => {
      down = true;
      onMove(e);
    };
    const onUp = () => {
      down = false;
      sx.target = 0;
      sy.target = 0;
      sx.impulse(sx.value * -5);
      sy.impulse(sy.value * -5);
    };
    inspectOverlay.addEventListener('pointermove', onMove);
    inspectOverlay.addEventListener('pointerdown', onDown);
    inspectOverlay.addEventListener('pointerup', onUp);
    let fade = 0;
    const stopTilt = onTick((dt) => {
      sx.step(dt);
      sy.step(dt);
      c.root.style.transform = `rotateX(${sx.value.toFixed(2)}deg) rotateY(${sy.value.toFixed(2)}deg)`;
      c.setShine(sx.value, sy.value, norm.x, norm.y);
      if (c.relief) {
        fade = Math.min(1, fade + dt * 3.2);
        c.relief.render({ tiltX: sx.value, tiltY: sy.value, lightU: light.x, lightV: light.y, intensity: fade });
      }
    });
    inspectCleanup = () => {
      inspectOverlay.removeEventListener('pointermove', onMove);
      inspectOverlay.removeEventListener('pointerdown', onDown);
      inspectOverlay.removeEventListener('pointerup', onUp);
      stopTilt();
      c.relief?.dispose();
    };
  }

  inspectOverlay.addEventListener('click', (e) => {
    if (e.target === inspectOverlay) {
      inspectOverlay.classList.remove('show');
      inspectCleanup?.();
      inspectCleanup = null;
    }
  });

  /* ------------------------------------------------------------------ */
  /* Wiring                                                              */
  /* ------------------------------------------------------------------ */

  packStage.addEventListener('pointerdown', onPackDown);
  packStage.addEventListener('pointermove', onPackMove);
  packStage.addEventListener('pointerup', onPackUp);
  packStage.addEventListener('pointercancel', onPackUp);

  el.querySelector('.back-btn')!.addEventListener('click', opts.onExit);
  el.querySelector('.exit-btn')!.addEventListener('click', opts.onExit);
  el.querySelector('.again-btn')!.addEventListener('click', opts.onAgain);
  el.querySelector('.skip-btn')!.addEventListener('click', () => {
    if (phase !== 'reveal') return;
    for (const c of cardEls.slice(Math.max(currentIdx, 0))) {
      c.relief?.dispose();
      c.root.remove();
    }
    currentIdx = cardEls.length;
    showSummary();
  });

  /* Map inspector — cycles what the shader writes out, so the demo can show
     the derived depth / normal / roughness channels, not just the lit result.
     Parallax stays applied in every mode: the maps visibly slide too. */
  const mapsBtn = el.querySelector<HTMLButtonElement>('.maps-btn')!;
  let debugIdx = 0;
  mapsBtn.addEventListener('click', () => {
    uiBlip();
    debugIdx = (debugIdx + 1) % RELIEF_DEBUG_MODES.length;
    const mode: ReliefDebug = RELIEF_DEBUG_MODES[debugIdx];
    setReliefDebug(mode);
    mapsBtn.textContent = `Maps: ${mode[0].toUpperCase()}${mode.slice(1)}`;
  });

  return {
    el,
    destroy() {
      disposed = true;
      inspectCleanup?.();
      for (const c of cardEls) c.relief?.dispose();
      for (const fn of cleanups) fn();
    },
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function seededJitter(seed: string): number {
  let s = 0;
  for (const ch of seed) s = (s * 31 + ch.charCodeAt(0)) | 0;
  return ((s % 100) / 100) * 3 - 1.5;
}
