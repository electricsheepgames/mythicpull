import type { CardData, ColorHint, PackCardRef, PackDefinition, Rarity } from './types';
import { shuffle } from './booster';

/**
 * Procedural card art for offline development / demos. Draws convincing-ish
 * card fronts, a card back, and pack key art onto canvases and returns data
 * URLs, so every interaction can be exercised with zero network access.
 */

const W = 672;
const H = 936;

interface MockSpec {
  color: [string, string];
  rarity: Rarity;
  type: string;
}

const COLOR_THEMES: Record<ColorHint, [string, string]> = {
  W: ['#f5eeda', '#c8b98a'],
  U: ['#3a6ea8', '#12233f'],
  B: ['#3d3346', '#120d18'],
  R: ['#b0432f', '#3f120a'],
  G: ['#3f7a44', '#10260f'],
  M: ['#c9a33b', '#4a3609'],
  A: ['#9aa3ad', '#2e3338'],
};

const MOCK_META: Record<string, MockSpec> = {
  'Llanowar Elves': { color: COLOR_THEMES.G, rarity: 'common', type: 'Creature — Elf Druid' },
  'Giant Growth': { color: COLOR_THEMES.G, rarity: 'common', type: 'Instant' },
  'Doom Blade': { color: COLOR_THEMES.B, rarity: 'common', type: 'Instant' },
  Shock: { color: COLOR_THEMES.R, rarity: 'common', type: 'Instant' },
  Divination: { color: COLOR_THEMES.U, rarity: 'common', type: 'Sorcery' },
  Pacifism: { color: COLOR_THEMES.W, rarity: 'common', type: 'Enchantment — Aura' },
  'Hero of Bladehold': { color: COLOR_THEMES.W, rarity: 'rare', type: 'Creature — Human Knight' },
  'Serra Angel': { color: COLOR_THEMES.W, rarity: 'uncommon', type: 'Creature — Angel' },
  Counterspell: { color: COLOR_THEMES.U, rarity: 'uncommon', type: 'Instant' },
  'Lightning Bolt': { color: COLOR_THEMES.R, rarity: 'uncommon', type: 'Instant' },
  'Birds of Paradise': { color: COLOR_THEMES.G, rarity: 'rare', type: 'Creature — Bird' },
  'Shivan Dragon': { color: COLOR_THEMES.R, rarity: 'rare', type: 'Creature — Dragon' },
  'Wrath of God': { color: COLOR_THEMES.W, rarity: 'rare', type: 'Sorcery' },
  'Sol Ring': { color: COLOR_THEMES.A, rarity: 'rare', type: 'Artifact' },
  'Atraxa, Grand Unifier': { color: COLOR_THEMES.M, rarity: 'mythic', type: 'Legendary Creature — Phyrexian Angel' },
};

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

/** Cheap deterministic PRNG so mock art is stable per card. */
function rng(seed: string): () => number {
  let s = 2166136261;
  for (const ch of seed) s = Math.imul(s ^ ch.charCodeAt(0), 16777619);
  return () => {
    s = Math.imul(s ^ (s >>> 15), 2246822519);
    s = Math.imul(s ^ (s >>> 13), 3266489917);
    return ((s ^= s >>> 16) >>> 0) / 4294967296;
  };
}

function drawArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: string, colors: [string, string]) {
  const rand = rng(seed);
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, colors[1]);
  g.addColorStop(1, colors[0]);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  // layered "landscape" ridges
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    const base = y + h * (0.35 + i * 0.15);
    ctx.moveTo(x, base);
    for (let px = 0; px <= w; px += w / 14) {
      ctx.lineTo(x + px, base - rand() * h * 0.18);
    }
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    ctx.fillStyle = `rgba(${10 + i * 8},${8 + i * 6},${20 + i * 10},${0.35 + i * 0.1})`;
    ctx.fill();
  }
  // glow orb
  const ox = x + w * (0.3 + rand() * 0.4);
  const oy = y + h * (0.2 + rand() * 0.25);
  const orb = ctx.createRadialGradient(ox, oy, 4, ox, oy, w * 0.35);
  orb.addColorStop(0, 'rgba(255,240,200,0.9)');
  orb.addColorStop(1, 'rgba(255,240,200,0)');
  ctx.fillStyle = orb;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

const RARITY_COLOR: Record<Rarity, string> = {
  common: '#1a1718',
  uncommon: '#b7c1c5',
  rare: '#d5b45f',
  mythic: '#e85d26',
};

function drawCardFront(name: string, spec: MockSpec, setCode: string): string {
  const [c, ctx] = canvas(W, H);
  // border
  ctx.fillStyle = '#171314';
  roundRect(ctx, 0, 0, W, H, 34);
  ctx.fill();
  // frame
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, spec.color[0]);
  g.addColorStop(1, spec.color[1]);
  ctx.fillStyle = g;
  roundRect(ctx, 26, 26, W - 52, H - 52, 18);
  ctx.fill();
  // title bar
  ctx.fillStyle = 'rgba(20,16,18,0.82)';
  roundRect(ctx, 44, 44, W - 88, 62, 12);
  ctx.fill();
  ctx.fillStyle = '#f2ead8';
  ctx.font = '600 34px Georgia, serif';
  ctx.textBaseline = 'middle';
  ctx.fillText(fitText(ctx, name, W - 130), 62, 77);
  // art
  drawArt(ctx, 44, 118, W - 88, 430, name, spec.color);
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 3;
  ctx.strokeRect(44, 118, W - 88, 430);
  // type line
  ctx.fillStyle = 'rgba(20,16,18,0.82)';
  roundRect(ctx, 44, 560, W - 88, 54, 12);
  ctx.fill();
  ctx.fillStyle = '#e8e0cc';
  ctx.font = '28px Georgia, serif';
  ctx.fillText(fitText(ctx, spec.type, W - 180), 62, 588);
  // rarity gem
  ctx.beginPath();
  ctx.arc(W - 74, 587, 16, 0, Math.PI * 2);
  ctx.fillStyle = RARITY_COLOR[spec.rarity];
  ctx.fill();
  // text box
  ctx.fillStyle = 'rgba(240,234,216,0.88)';
  roundRect(ctx, 44, 626, W - 88, 250, 12);
  ctx.fill();
  ctx.fillStyle = '#2b2622';
  ctx.font = 'italic 26px Georgia, serif';
  wrapText(ctx, sampleFlavor(name), 66, 668, W - 132, 36);
  // bottom line
  ctx.fillStyle = 'rgba(235,228,210,0.75)';
  ctx.font = '22px monospace';
  ctx.fillText(`${setCode.toUpperCase()} · MythicPull sample`, 48, H - 34);
  return c.toDataURL('image/jpeg', 0.85);
}

export function mockCardBack(): string {
  const [c, ctx] = canvas(W, H);
  ctx.fillStyle = '#241a12';
  roundRect(ctx, 0, 0, W, H, 34);
  ctx.fill();
  const g = ctx.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, H * 0.7);
  g.addColorStop(0, '#5a4a33');
  g.addColorStop(1, '#241a12');
  ctx.fillStyle = g;
  roundRect(ctx, 22, 22, W - 44, H - 44, 24);
  ctx.fill();
  // oval emblem
  ctx.save();
  ctx.translate(W / 2, H / 2 - 40);
  ctx.beginPath();
  ctx.ellipse(0, 0, 200, 250, 0, 0, Math.PI * 2);
  const eg = ctx.createLinearGradient(-200, -250, 200, 250);
  eg.addColorStop(0, '#7a5cc2');
  eg.addColorStop(0.5, '#3b2f6b');
  eg.addColorStop(1, '#1c1636');
  ctx.fillStyle = eg;
  ctx.fill();
  ctx.strokeStyle = '#c8a24a';
  ctx.lineWidth = 8;
  ctx.stroke();
  // five "mana" dots
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * 120, Math.sin(a) * 155, 26, 0, Math.PI * 2);
    ctx.fillStyle = ['#f5eeda', '#3a6ea8', '#2b2233', '#b0432f', '#3f7a44'][i];
    ctx.fill();
    ctx.strokeStyle = '#c8a24a';
    ctx.lineWidth = 4;
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = '#d9c8a0';
  ctx.font = '700 52px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('MYTHICPULL', W / 2, H - 120);
  return c.toDataURL('image/jpeg', 0.85);
}

export function mockKeyArt(pack: PackDefinition): string {
  const [c, ctx] = canvas(640, 480);
  drawArt(ctx, 0, 0, 640, 480, pack.name, [pack.accent, '#0c0a18']);
  return c.toDataURL('image/jpeg', 0.85);
}

export function mockCardsFor(pack: PackDefinition): CardData[] {
  const refs: PackCardRef[] = pack.cards.length
    ? pack.cards
    : Object.keys(MOCK_META).map((name) => ({ name }));
  // Offline there's no set pool to draw from, so contents can't vary — but
  // the reveal order still should: shuffle within each rarity group, keeping
  // the rarity ramp intact and the marked foil(s) last. Packs that declare
  // `fixedContents` opt out entirely and keep the registry order.
  const ordered = pack.fixedContents ? refs : shuffleWithinRarity(refs);
  return ordered.map((ref, i) => {
    // Registry rarity/color hints beat MOCK_META so any pack renders sensibly
    // offline; unhinted cards fall back to a name-hashed color for variety.
    const meta = MOCK_META[ref.name];
    const spec: MockSpec = {
      color: (ref.color && COLOR_THEMES[ref.color]) || meta?.color || hashedColor(ref.name),
      rarity: ref.rarity ?? meta?.rarity ?? 'common',
      type: meta?.type ?? 'Card',
    };
    const img = drawCardFront(ref.name, spec, pack.setCode);
    return {
      id: `mock-${pack.id}-${i}`,
      name: ref.name,
      setCode: pack.setCode,
      setName: pack.name,
      rarity: spec.rarity,
      typeLine: spec.type,
      imageLarge: img,
      imageNormal: img,
      foil: ref.foil ?? spec.rarity === 'mythic',
    };
  });
}

const RARITY_ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'mythic'];

function shuffleWithinRarity(refs: PackCardRef[]): PackCardRef[] {
  const groups: Record<Rarity, PackCardRef[]> = { common: [], uncommon: [], rare: [], mythic: [] };
  const foils: PackCardRef[] = [];
  for (const ref of refs) {
    if (ref.foil) foils.push(ref);
    else groups[ref.rarity ?? MOCK_META[ref.name]?.rarity ?? 'common'].push(ref);
  }
  const out: PackCardRef[] = [];
  for (const r of RARITY_ORDER) out.push(...shuffle(groups[r]));
  out.push(...shuffle(foils));
  return out;
}

/** Stable pseudo-random frame theme for cards with no color hint. */
function hashedColor(name: string): [string, string] {
  const themes = Object.values(COLOR_THEMES);
  return themes[Math.floor(rng(name)() * themes.length)];
}

/* ---------- tiny drawing helpers ---------- */

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  while (text.length > 3 && ctx.measureText(text + '…').width > maxW) text = text.slice(0, -1);
  return text + '…';
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number) {
  const words = text.split(' ');
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y);
      line = word;
      y += lineH;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, y);
}

function sampleFlavor(name: string): string {
  return `“${name}” — a placeholder rendering used while offline. Live card images stream from Scryfall.`;
}
