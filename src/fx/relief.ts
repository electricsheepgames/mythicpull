/**
 * Material-map derivation.
 *
 * Real cards are printed, not modelled — there is no depth channel to load.
 * So we synthesize one from the only thing we have, the card face itself:
 *
 *   depth      multi-band emboss of luminance. Flat regions sit at 0.5;
 *              frame edges, rules text and painted detail push up or sink in.
 *   normal     Sobel of the depth map, tangent space, y pointing *down* to
 *              match UV space (see reliefRenderer.ts — everything downstream
 *              stays in image coordinates).
 *   roughness  local high-frequency energy. Painted art is rough and scatters
 *              light; the flat black border and the text box are smooth and
 *              take a tight specular highlight, like real card stock.
 *   cavity     depth minus its own neighbourhood — an ambient-occlusion-ish
 *              term that darkens the creases the emboss just carved.
 *
 * All of it is one CPU pass over a downscaled copy (a few ms per card); the
 * shader samples the results bilinearly at full card size.
 */

export interface ReliefMaps {
  width: number;
  height: number;
  /** Tangent-space normal, xyz packed into rgb. */
  normal: ImageData;
  /** r = depth, g = roughness, b = cavity AO. */
  material: ImageData;
}

/**
 * Maps are derived at this width; the aspect follows the source image. The
 * shader samples them bilinearly, so this trades map crispness against the
 * one-off CPU cost per card (tens of milliseconds) — 384 keeps rules text
 * legible in the emboss without a noticeable hitch.
 */
const MAP_WIDTH = 384;

/** How hard the Sobel gradients tip the normals. */
const NORMAL_STRENGTH = 2.6;

/**
 * Derive depth/normal/roughness for one card face. Returns null when the
 * image can't be read — not decoded yet, or cross-origin without CORS, which
 * taints the canvas and would also make it unusable as a WebGL texture.
 */
export function deriveReliefMaps(source: HTMLImageElement): ReliefMaps | null {
  const sw = source.naturalWidth;
  const sh = source.naturalHeight;
  if (!sw || !sh) return null;

  const w = MAP_WIDTH;
  const h = Math.max(1, Math.round((MAP_WIDTH * sh) / sw));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, w, h);

  let px: Uint8ClampedArray;
  try {
    px = ctx.getImageData(0, 0, w, h).data;
  } catch {
    return null; // tainted canvas — no CORS on the card image
  }

  const n = w * h;
  const luma = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    luma[i] = (0.2126 * px[o] + 0.7152 * px[o + 1] + 0.0722 * px[o + 2]) / 255;
  }

  // Three octaves of the same signal. Differencing them isolates detail at a
  // given scale, which is what makes the emboss read on any art: the result
  // is relative to the local tone, so a dark border and a bright text box
  // both settle at the neutral 0.5 plane.
  const fine = boxBlur(luma, w, h, 1);
  const mid = boxBlur(luma, w, h, 4);
  const broad = boxBlur(luma, w, h, 14);

  const depth = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    depth[i] = clamp01(
      0.5 + (mid[i] - broad[i]) * 1.7 + (fine[i] - mid[i]) * 1.15 + (broad[i] - 0.5) * 0.3,
    );
  }

  // Roughness: how much high-frequency energy sits under each pixel. Detailed
  // art scatters, flat ink is glossy; dark areas skew glossier still (the
  // black border on a real card is the shiniest part of it).
  const deviation = new Float32Array(n);
  for (let i = 0; i < n; i++) deviation[i] = Math.abs(luma[i] - mid[i]);
  const rough = boxBlur(deviation, w, h, 3);

  // Cavity: where the emboss dipped below its own surroundings.
  const depthSmooth = boxBlur(depth, w, h, 3);

  const normal = new ImageData(w, h);
  const material = new ImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const o = i * 4;

      // Sobel, clamped at the edges.
      const x0 = x > 0 ? x - 1 : 0;
      const x1 = x < w - 1 ? x + 1 : w - 1;
      const y0 = y > 0 ? y - 1 : 0;
      const y1 = y < h - 1 ? y + 1 : h - 1;
      const tl = depth[y0 * w + x0];
      const tc = depth[y0 * w + x];
      const tr = depth[y0 * w + x1];
      const ml = depth[y * w + x0];
      const mr = depth[y * w + x1];
      const bl = depth[y1 * w + x0];
      const bc = depth[y1 * w + x];
      const br = depth[y1 * w + x1];
      const dx = tr + 2 * mr + br - (tl + 2 * ml + bl);
      const dy = bl + 2 * bc + br - (tl + 2 * tc + tr);

      // y is left pointing down: the map is consumed in UV space, not in a
      // y-up tangent basis.
      let nx = -dx * NORMAL_STRENGTH;
      let ny = -dy * NORMAL_STRENGTH;
      let nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len;
      ny /= len;
      nz /= len;

      normal.data[o] = (nx * 0.5 + 0.5) * 255;
      normal.data[o + 1] = (ny * 0.5 + 0.5) * 255;
      normal.data[o + 2] = (nz * 0.5 + 0.5) * 255;
      normal.data[o + 3] = 255;

      material.data[o] = depth[i] * 255;
      material.data[o + 1] = clamp01(0.26 + rough[i] * 3.4 - (0.5 - luma[i]) * 0.28) * 255;
      material.data[o + 2] = clamp01(0.5 + (depth[i] - depthSmooth[i]) * 1.8) * 255;
      material.data[o + 3] = 255;
    }
  }

  return { width: w, height: h, normal, material };
}

/** Separable box blur with a running sum — O(n) regardless of radius. */
function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  if (r < 1) return src.slice();
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  const norm = 1 / (2 * r + 1);

  for (let y = 0; y < h; y++) {
    const row = y * w;
    let sum = 0;
    for (let i = -r; i <= r; i++) sum += src[row + clampInt(i, 0, w - 1)];
    for (let x = 0; x < w; x++) {
      tmp[row + x] = sum * norm;
      sum += src[row + clampInt(x + r + 1, 0, w - 1)] - src[row + clampInt(x - r, 0, w - 1)];
    }
  }
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let i = -r; i <= r; i++) sum += tmp[clampInt(i, 0, h - 1) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = sum * norm;
      sum += tmp[clampInt(y + r + 1, 0, h - 1) * w + x] - tmp[clampInt(y - r, 0, h - 1) * w + x];
    }
  }
  return out;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function clampInt(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
