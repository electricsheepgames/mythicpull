import type { ReliefMaps } from './relief';

/**
 * Relief renderer — the lit half of the demo pipeline.
 *
 * One WebGL2 context, one canvas, reused by whichever card is currently on
 * screen (only ever one at a time), so a 14-card pack doesn't burn through
 * the browser's context budget. A surface owns its three textures and lends
 * the shared canvas while it's mounted.
 *
 * The shader does relief (parallax-occlusion) mapping against the derived
 * depth map, then Blinn-Phong shading with a point light that lives wherever
 * the pointer is. Moving the mouse moves the light *and* the eye, so the
 * printed surface both re-lights and physically shifts under the cursor.
 *
 * Everything is expressed in UV space with +y pointing down, matching the
 * maps in relief.ts and the DOM. `uAspect` converts UV distances into
 * card-width units so the light falls off in a circle, not an ellipse.
 */

export type ReliefDebug = 'lit' | 'depth' | 'normal' | 'roughness';

/** Cycle order for the demo's map inspector. */
export const RELIEF_DEBUG_MODES: ReliefDebug[] = ['lit', 'depth', 'normal', 'roughness'];

const DEBUG_INDEX: Record<ReliefDebug, number> = { lit: 0, depth: 1, normal: 2, roughness: 3 };

export interface ReliefState {
  /** Card tilt in degrees — the same values that drive the CSS transform. */
  tiltX: number;
  tiltY: number;
  /**
   * Pointer position in the card's own UV space. Deliberately unclamped: the
   * light keeps travelling once the cursor leaves the card, which is what
   * makes it read as a lamp in the room rather than a decal on the surface.
   */
  lightU: number;
  lightV: number;
  /** 0..1 crossfade from the flat scan to the fully lit surface. */
  intensity: number;
}

const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  // Clip space to UV with y flipped: textures are uploaded top-row-first.
  vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uAlbedo;
uniform sampler2D uNormalMap;
uniform sampler2D uMaterial;   // r = depth, g = roughness, b = cavity
uniform vec3 uView;            // surface -> eye, tangent space
uniform vec3 uLight;           // xy in UV space, z above the surface
uniform vec2 uAspect;          // (1, cardHeight / cardWidth)
uniform float uDepth;          // max parallax shift, in UV units
uniform float uFoil;
uniform float uIntensity;
uniform int uDebug;

/** Spread of the eye vector across the face — the card's own perspective. */
const float PERSPECTIVE = 0.5;

/**
 * Depth for the march (inverted height), compressed toward the mean plane.
 * The map itself keeps full contrast — the normals want it — but marching the
 * whole range makes a hard-edged pit like a title bar deep enough to smear at
 * steep angles, and printed card stock is nowhere near that deep.
 */
float marchDepth(vec2 uv) {
  return 0.5 - (texture(uMaterial, uv).r - 0.5) * 0.65;
}

/**
 * Steep parallax with a linear-interpolated final step. Raised ink occludes
 * the sunken background as the view angle grows, which is the whole point:
 * the surface has thickness.
 */
vec2 relief(vec2 uv, vec3 v, float depthScale) {
  // Step count follows the actual shift, not just the view angle: a long
  // march with few layers is what produces smeared ghosts at height steps.
  float steepness = clamp(length(v.xy) / max(v.z, 0.3), 0.0, 1.0);
  float layers = mix(12.0, 32.0, steepness);
  float layerStep = 1.0 / layers;
  vec2 delta = (v.xy / max(v.z, 0.3)) * depthScale * layerStep;
  vec2 cur = uv;
  float depth = marchDepth(cur);
  float layer = 0.0;
  for (int i = 0; i < 32; i++) {
    if (layer >= depth) break;
    cur = clamp(cur - delta, 0.0, 1.0);
    depth = marchDepth(cur);
    layer += layerStep;
  }
  vec2 prev = clamp(cur + delta, 0.0, 1.0);
  float after = depth - layer;
  float before = marchDepth(prev) - layer + layerStep;
  float w = clamp(after / (after - before - 1e-5), 0.0, 1.0);
  return clamp(mix(cur, prev, w), 0.0, 1.0);
}

void main() {
  vec3 v = normalize(uView + vec3((vUv - 0.5) * PERSPECTIVE * uAspect, 0.0));

  // Ease the displacement out at the card's own edge. Without this the black
  // border shears off the face at steep angles, which reads as a broken
  // texture rather than a thick one.
  float edge = min(min(vUv.x, 1.0 - vUv.x) / 0.05, min(vUv.y, 1.0 - vUv.y) / 0.035);
  vec2 uv = relief(vUv, v, uDepth * smoothstep(0.0, 1.0, clamp(edge, 0.0, 1.0)));

  vec3 n = normalize(texture(uNormalMap, uv).xyz * 2.0 - 1.0);
  vec3 mat = texture(uMaterial, uv).rgb;
  vec3 albedo = texture(uAlbedo, uv).rgb;

  vec3 toLight = vec3((uLight.xy - uv) * uAspect, uLight.z);
  float dist = length(toLight);
  vec3 l = toLight / max(dist, 1e-4);
  float atten = 1.0 / (1.0 + 3.0 * dist * dist);

  float ndl = max(dot(n, l), 0.0);
  vec3 half3 = normalize(l + v);
  float ndh = max(dot(n, half3), 0.0);
  float rough = clamp(mat.g, 0.04, 1.0);
  float spec = pow(ndh, mix(340.0, 9.0, rough)) * mix(1.5, 0.16, rough);
  float fresnel = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 4.0);
  float cavity = mix(0.8, 1.14, mat.b);

  vec3 lit = albedo * (0.46 + 1.75 * ndl * atten) * cavity;
  lit += vec3(spec * atten * 2.6);
  lit += albedo * fresnel * 0.28;

  if (uFoil > 0.5) {
    // Thin-film-ish: the half-vector angle drives the hue, so the rainbow
    // rakes across as the card tilts instead of riding along with it.
    float phase = ndh * 9.0 + uv.x * 2.0 + uv.y * 3.0;
    vec3 iridescence = 0.5 + 0.5 * cos(6.28318 * (phase + vec3(0.0, 0.33, 0.67)));
    float sheen = pow(ndh, 26.0);
    lit += iridescence * (sheen * 0.6 + spec * 0.9) * atten * 1.7;
  }

  vec3 color = mix(albedo, lit, uIntensity);
  if (uDebug == 1) color = vec3(mat.r);
  else if (uDebug == 2) color = texture(uNormalMap, uv).rgb;
  else if (uDebug == 3) color = vec3(mat.g);

  fragColor = vec4(color, 1.0);
}`;

interface Engine {
  canvas: HTMLCanvasElement;
  gl: WebGL2RenderingContext;
  program: WebGLProgram;
  uniforms: Record<string, WebGLUniformLocation | null>;
  /** The surface currently borrowing the canvas. */
  active: ReliefSurface | null;
}

let engine: Engine | null | undefined;
let debugMode: ReliefDebug = 'lit';

function getEngine(): Engine | null {
  if (engine === undefined) engine = createEngine();
  return engine;
}

function createEngine(): Engine | null {
  const canvas = document.createElement('canvas');
  canvas.className = 'relief-canvas';
  const gl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: false,
    depth: false,
    premultipliedAlpha: false,
    powerPreference: 'high-performance',
  });
  if (!gl) return null;

  const program = link(gl, VERT, FRAG);
  if (!program) return null;

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  gl.useProgram(program);
  const uniforms: Engine['uniforms'] = {};
  for (const name of ['uAlbedo', 'uNormalMap', 'uMaterial', 'uView', 'uLight', 'uAspect', 'uDepth', 'uFoil', 'uIntensity', 'uDebug']) {
    uniforms[name] = gl.getUniformLocation(program, name);
  }
  gl.uniform1i(uniforms.uAlbedo, 0);
  gl.uniform1i(uniforms.uNormalMap, 1);
  gl.uniform1i(uniforms.uMaterial, 2);

  return { canvas, gl, program, uniforms, active: null };
}

function link(gl: WebGL2RenderingContext, vertSrc: string, fragSrc: string): WebGLProgram | null {
  const vert = compile(gl, gl.VERTEX_SHADER, vertSrc);
  const frag = compile(gl, gl.FRAGMENT_SHADER, fragSrc);
  if (!vert || !frag) return null;
  const program = gl.createProgram();
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn('[relief] program link failed:', gl.getProgramInfoLog(program));
    return null;
  }
  return program;
}

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader | null {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn('[relief] shader compile failed:', gl.getShaderInfoLog(shader));
    return null;
  }
  return shader;
}

/** Is the relief pipeline usable at all (WebGL2 present, shaders compiled)? */
export function reliefSupported(): boolean {
  return getEngine() !== null;
}

/** Which channel the shader outputs — the demo's map inspector drives this. */
export function setReliefDebug(mode: ReliefDebug) {
  debugMode = mode;
}

export class ReliefSurface {
  private readonly engine: Engine;
  private readonly albedo: WebGLTexture;
  private readonly normal: WebGLTexture;
  private readonly material: WebGLTexture;
  private readonly aspect: number;
  private host: HTMLElement | null = null;
  private disposed = false;

  constructor(engineRef: Engine, source: TexImageSource, maps: ReliefMaps, private foil: boolean) {
    this.engine = engineRef;
    const gl = engineRef.gl;
    this.albedo = texture(gl, source);
    this.normal = texture(gl, maps.normal);
    this.material = texture(gl, maps.material);
    this.aspect = maps.height / maps.width;
  }

  /** Borrow the shared canvas and hang it in front of the card's face. */
  mount(host: HTMLElement) {
    if (this.disposed) return;
    const prev = this.engine.active;
    if (prev && prev !== this) prev.host = null;
    this.engine.active = this;
    this.host = host;
    host.appendChild(this.engine.canvas);
  }

  unmount() {
    if (this.engine.active !== this) return;
    this.engine.active = null;
    this.host = null;
    this.engine.canvas.remove();
  }

  get mounted(): boolean {
    return this.engine.active === this && !!this.host;
  }

  render(state: ReliefState) {
    if (this.disposed || !this.mounted || !this.host) return;
    const { gl, canvas, uniforms } = this.engine;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(this.host.clientWidth * dpr));
    const h = Math.max(1, Math.round(this.host.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl.viewport(0, 0, w, h);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.albedo);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.normal);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.material);

    // Eye direction for a card rotated rotateX(tiltX) rotateY(tiltY), then
    // nudged toward the pointer so the relief slides with the cursor even
    // when the card is sitting still.
    const rx = (state.tiltX * Math.PI) / 180;
    const ry = (state.tiltY * Math.PI) / 180;
    let vx = -Math.cos(rx) * Math.sin(ry) + clamp(state.lightU - 0.5, -1, 1) * 0.34;
    let vy = -Math.sin(rx) + clamp(state.lightV - 0.5, -1, 1) * 0.34;
    let vz = Math.max(Math.cos(rx) * Math.cos(ry), 0.25);
    const len = Math.hypot(vx, vy, vz);
    vx /= len;
    vy /= len;
    vz /= len;

    gl.uniform3f(uniforms.uView, vx, vy, vz);
    gl.uniform3f(uniforms.uLight, clamp(state.lightU, -1.2, 2.2), clamp(state.lightV, -1.2, 2.2), 0.42);
    gl.uniform2f(uniforms.uAspect, 1, this.aspect);
    gl.uniform1f(uniforms.uDepth, 0.030);
    gl.uniform1f(uniforms.uFoil, this.foil ? 1 : 0);
    gl.uniform1f(uniforms.uIntensity, clamp(state.intensity, 0, 1));
    gl.uniform1i(uniforms.uDebug, DEBUG_INDEX[debugMode]);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  dispose() {
    if (this.disposed) return;
    this.unmount();
    this.disposed = true;
    const gl = this.engine.gl;
    gl.deleteTexture(this.albedo);
    gl.deleteTexture(this.normal);
    gl.deleteTexture(this.material);
  }
}

/**
 * Build a surface for one card face. Returns null when WebGL2 is missing or
 * the image can't be uploaded (cross-origin without CORS) — callers fall back
 * to the plain `<img>`, which is still sitting underneath.
 */
export function createReliefSurface(
  source: TexImageSource,
  maps: ReliefMaps,
  opts: { foil: boolean },
): ReliefSurface | null {
  const eng = getEngine();
  if (!eng) return null;
  try {
    return new ReliefSurface(eng, source, maps, opts.foil);
  } catch (err) {
    console.warn('[relief] surface creation failed:', err);
    return null;
  }
}

function texture(gl: WebGL2RenderingContext, source: TexImageSource): WebGLTexture {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  return tex;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
