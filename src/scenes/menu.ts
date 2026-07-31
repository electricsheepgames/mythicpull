import type { Scene } from '../main';
import type { PackDefinition } from '../data/types';
import { PACKS } from '../data/packs';
import { resolveKeyArt } from '../data/scryfall';
import { buildPack } from '../components/wrapper';
import { onTick } from '../fx/spring';
import { uiBlip, setMuted, isMuted } from '../fx/sound';

/**
 * Pack select. A slowly-turning 3D preview of the chosen pack sits center
 * stage; the set rail below swaps it. Future sets render as locked cards in
 * the same rail, so adding one is just a registry entry.
 */

export function menuScene(opts: { onOpenPack: (pack: PackDefinition) => void }): Scene {
  const el = document.createElement('section');
  el.className = 'scene menu-scene';
  el.innerHTML = `
    <header class="menu-head">
      <h1 class="logo">MYTHIC<span>PULL</span></h1>
      <p class="menu-sub">Crack a booster · card art via Scryfall</p>
    </header>
    <div class="menu-preview">
      <div class="menu-pack-mount"></div>
    </div>
    <div class="menu-controls">
      <div class="set-rail" role="listbox" aria-label="Choose a set"></div>
      <button class="btn btn-primary open-btn">Open Pack</button>
    </div>
    <button class="btn-icon mute-btn" title="Toggle sound">${isMuted() ? '🔇' : '🔊'}</button>
  `;

  const mount = el.querySelector<HTMLDivElement>('.menu-pack-mount')!;
  const rail = el.querySelector<HTMLDivElement>('.set-rail')!;
  const openBtn = el.querySelector<HTMLButtonElement>('.open-btn')!;
  const muteBtn = el.querySelector<HTMLButtonElement>('.mute-btn')!;

  let selected = PACKS.find((p) => !p.comingSoon) ?? PACKS[0];
  let disposed = false;
  let rotY = -18;

  // slow idle spin on the preview pack
  let packEl: ReturnType<typeof buildPack> | null = null;
  const stopSpin = onTick((dt) => {
    if (!packEl) return;
    rotY += dt * 24;
    const sway = Math.sin(performance.now() / 1400) * 4;
    packEl.root.style.transform = `rotateY(${rotY}deg) rotateX(${sway * 0.4}deg)`;
    packEl.setSpin(rotY);
  });

  async function mountPack(pack: PackDefinition) {
    const art = await resolveKeyArt(pack);
    if (disposed || pack !== selected) return;
    mount.innerHTML = '';
    packEl = buildPack(pack, art);
    packEl.root.classList.add('menu-pack');
    packEl.tearGuide.style.display = 'none';
    mount.appendChild(packEl.root);
    el.style.setProperty('--accent', pack.accent);
    el.style.setProperty('--accent2', pack.accentSecondary);
  }

  for (const pack of PACKS) {
    const b = document.createElement('button');
    b.className = 'set-chip';
    b.role = 'option';
    b.disabled = !!pack.comingSoon;
    b.innerHTML = `
      <span class="chip-code">${pack.setCode.toUpperCase()}</span>
      <span class="chip-name">${pack.name}</span>
      ${pack.comingSoon ? '<span class="chip-soon">SOON</span>' : ''}
      ${pack.demo ? '<span class="chip-demo">DEMO</span>' : ''}
    `;
    b.style.setProperty('--accent', pack.accent);
    if (pack === selected) b.classList.add('active');
    b.addEventListener('click', () => {
      if (pack.comingSoon) return;
      uiBlip();
      selected = pack;
      rail.querySelectorAll('.set-chip').forEach((c) => c.classList.remove('active'));
      b.classList.add('active');
      void mountPack(pack);
    });
    rail.appendChild(b);
  }

  openBtn.addEventListener('click', () => {
    uiBlip();
    opts.onOpenPack(selected);
  });

  muteBtn.addEventListener('click', () => {
    setMuted(!isMuted());
    muteBtn.textContent = isMuted() ? '🔇' : '🔊';
  });

  void mountPack(selected);

  return {
    el,
    destroy() {
      disposed = true;
      stopSpin();
    },
  };
}
