import {
  COMPOSITE_FRAGMENT,
  NEBULA_FRAGMENT,
  QUAD_VERTEX,
  STAR_FRAGMENT,
  STAR_VERTEX,
} from "./shaders";

/**
 * The atmosphere the Muṣḥaf sits in.
 *
 * Framework-agnostic on purpose: React owns when this exists, never what it
 * does per frame. Everything the reader's behaviour feeds in goes through
 * `setSignals`, which only writes numbers — no allocation, no DOM, nothing
 * that could put work on the main thread while a page is turning.
 *
 * Cost control, in order of how much it saves:
 *  - the nebula renders into a 320px offscreen texture at ~12fps, because it
 *    breathes over tens of seconds and nobody can see the difference;
 *  - the starfield is one `POINTS` draw with all motion in the vertex shader;
 *  - the drawing buffer is capped well below device pixel ratio, since every
 *    pixel here is deliberately soft.
 */

export interface AmbienceSignals {
  /** Signed reading velocity, roughly −1 … 1. */
  velocity: number;
  /** 0 moving briskly, 1 settled on a verse. */
  calm: number;
  /** Sustained-ness of the page's recitation. */
  flow: number;
  /** Percussive-ness. */
  grain: number;
  /** Sibilance. */
  brightness: number;
  /** How strongly the page locks to one rhyme. */
  rhymeRun: number;
  /** Short verses in quick succession. */
  density: number;
}

const DEFAULT_SIGNALS: AmbienceSignals = {
  velocity: 0,
  calm: 0.5,
  flow: 0.3,
  grain: 0.2,
  brightness: 0.2,
  rhymeRun: 0.3,
  density: 0.4,
};

const MAX_RIPPLES = 6;
const NEBULA_SIZE = 320;
const NEBULA_INTERVAL_MS = 80;
const RIPPLE_LIFETIME_S = 2.4;

interface Ripple {
  x: number;
  y: number;
  start: number;
  strength: number;
}

export class AmbienceEngine {
  private gl: WebGL2RenderingContext;
  private canvas: HTMLCanvasElement;

  private nebulaProgram: WebGLProgram;
  private starProgram: WebGLProgram;
  private compositeProgram: WebGLProgram;

  private quadVao: WebGLVertexArrayObject;
  private starVao: WebGLVertexArrayObject;
  private nebulaTexture: WebGLTexture;
  private nebulaFbo: WebGLFramebuffer;

  private starCount: number;
  private octaves: number;
  private dprCap: number;

  private signals: AmbienceSignals = { ...DEFAULT_SIGNALS };
  /** Signals are eased toward, never snapped to — the sky has inertia. */
  private eased: AmbienceSignals = { ...DEFAULT_SIGNALS };

  private ripples: Ripple[] = [];
  private rippleBuffer = new Float32Array(MAX_RIPPLES * 4);

  private frame: number | null = null;
  private startedAt = performance.now();
  private lastNebulaAt = 0;
  private running = false;
  private disposed = false;

  private uniforms = new Map<WebGLProgram, Map<string, WebGLUniformLocation | null>>();

  constructor(
    canvas: HTMLCanvasElement,
    options: { starCount?: number; octaves?: number; dprCap?: number } = {},
  ) {
    const gl = canvas.getContext("webgl2", {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: true,
      powerPreference: "low-power",
      desynchronized: true,
    });
    if (!gl) throw new Error("WebGL2 unavailable");

    this.gl = gl;
    this.canvas = canvas;
    this.starCount = options.starCount ?? 420;
    this.octaves = options.octaves ?? 4;
    this.dprCap = options.dprCap ?? 1.5;

    this.nebulaProgram = this.link(QUAD_VERTEX, NEBULA_FRAGMENT);
    this.starProgram = this.link(STAR_VERTEX, STAR_FRAGMENT);
    this.compositeProgram = this.link(QUAD_VERTEX, COMPOSITE_FRAGMENT);

    this.quadVao = this.createQuad();
    this.starVao = this.createStars();

    const { texture, fbo } = this.createNebulaTarget();
    this.nebulaTexture = texture;
    this.nebulaFbo = fbo;

    gl.enable(gl.BLEND);
    // Premultiplied additive: motes and nebula add light rather than occlude.
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);

    this.resize();
  }

  /* ---------------------------------------------------------------- *
   * Public surface
   * ---------------------------------------------------------------- */

  setSignals(next: Partial<AmbienceSignals>) {
    Object.assign(this.signals, next);
  }

  /** `x` and `y` are viewport pixels — where the reader actually touched. */
  ripple(x: number, y: number, strength = 1) {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    this.ripples.push({
      x: ((x - rect.left) / rect.width) * 2 - 1,
      // Clip space runs upward; viewport coordinates run downward.
      y: (1 - (y - rect.top) / rect.height) * 2 - 1,
      start: this.now(),
      strength,
    });
    if (this.ripples.length > MAX_RIPPLES) this.ripples.shift();
  }

  start() {
    if (this.running || this.disposed) return;
    this.running = true;
    this.frame = requestAnimationFrame(this.tick);
  }

  stop() {
    this.running = false;
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, this.dprCap);
    const width = Math.max(1, Math.round(this.canvas.clientWidth * dpr));
    const height = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
    if (this.canvas.width === width && this.canvas.height === height) return;
    this.canvas.width = width;
    this.canvas.height = height;
  }

  dispose() {
    this.stop();
    this.disposed = true;
    const gl = this.gl;
    gl.deleteProgram(this.nebulaProgram);
    gl.deleteProgram(this.starProgram);
    gl.deleteProgram(this.compositeProgram);
    gl.deleteVertexArray(this.quadVao);
    gl.deleteVertexArray(this.starVao);
    gl.deleteTexture(this.nebulaTexture);
    gl.deleteFramebuffer(this.nebulaFbo);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  }

  /* ---------------------------------------------------------------- *
   * Frame
   * ---------------------------------------------------------------- */

  private now() {
    return (performance.now() - this.startedAt) / 1000;
  }

  private tick = () => {
    if (!this.running) return;
    this.frame = requestAnimationFrame(this.tick);

    const gl = this.gl;
    const time = this.now();
    this.resize();
    this.ease();

    const nowMs = performance.now();
    if (nowMs - this.lastNebulaAt >= NEBULA_INTERVAL_MS) {
      this.lastNebulaAt = nowMs;
      this.drawNebula(time);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);

    this.drawComposite();
    this.drawStars(time);
  };

  /**
   * Ease toward the target signals. Calm rises slowly and falls quickly: the
   * sanctuary should take a moment to settle around a reader who has stopped,
   * and give way immediately when they move.
   */
  private ease() {
    const e = this.eased;
    const s = this.signals;
    e.calm += (s.calm - e.calm) * (s.calm > e.calm ? 0.012 : 0.09);
    e.velocity += (s.velocity - e.velocity) * 0.08;
    e.flow += (s.flow - e.flow) * 0.02;
    e.grain += (s.grain - e.grain) * 0.02;
    e.brightness += (s.brightness - e.brightness) * 0.02;
    e.rhymeRun += (s.rhymeRun - e.rhymeRun) * 0.02;
    e.density += (s.density - e.density) * 0.02;
  }

  private drawNebula(time: number) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.nebulaFbo);
    gl.viewport(0, 0, NEBULA_SIZE, NEBULA_SIZE);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this.nebulaProgram);
    const u = (name: string) => this.uniform(this.nebulaProgram, name);
    const aspect = this.canvas.width / Math.max(this.canvas.height, 1);

    gl.uniform1f(u("uTime"), time);
    gl.uniform2f(u("uAspect"), Math.max(aspect, 1), Math.max(1 / aspect, 1));
    gl.uniform1i(u("uOctaves"), this.octaves);
    gl.uniform1f(u("uCalm"), this.eased.calm);
    gl.uniform1f(u("uFlow"), this.eased.flow);
    gl.uniform1f(u("uGrain"), this.eased.grain);
    gl.uniform1f(u("uBrightness"), this.eased.brightness);
    gl.uniform1f(u("uRhymeRun"), this.eased.rhymeRun);

    gl.bindVertexArray(this.quadVao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  private drawComposite() {
    const gl = this.gl;
    gl.useProgram(this.compositeProgram);
    const u = (name: string) => this.uniform(this.compositeProgram, name);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.nebulaTexture);
    gl.uniform1i(u("uNebula"), 0);
    gl.uniform1f(u("uWarmth"), 0.55 + this.eased.calm * 0.6);
    // A settled reader gets a tighter, deeper pool of light.
    gl.uniform2f(u("uHalo"), 2.6 - this.eased.calm * 0.9, 0.16 + this.eased.calm * 0.13);

    gl.bindVertexArray(this.quadVao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  private drawStars(time: number) {
    const gl = this.gl;
    gl.useProgram(this.starProgram);
    const u = (name: string) => this.uniform(this.starProgram, name);

    gl.uniform1f(u("uTime"), time);
    gl.uniform2f(u("uResolution"), this.canvas.width, this.canvas.height);
    gl.uniform1f(u("uDpr"), Math.min(window.devicePixelRatio || 1, this.dprCap));
    gl.uniform1f(u("uVelocity"), this.eased.velocity);
    gl.uniform1f(u("uCalm"), this.eased.calm);
    gl.uniform1f(u("uDensity"), this.eased.density);

    this.packRipples(time);
    gl.uniform4fv(u("uRipples"), this.rippleBuffer);

    gl.bindVertexArray(this.starVao);
    gl.drawArrays(gl.POINTS, 0, this.starCount);
  }

  private packRipples(time: number) {
    this.ripples = this.ripples.filter((r) => time - r.start <= RIPPLE_LIFETIME_S);
    this.rippleBuffer.fill(0);
    this.ripples.forEach((ripple, i) => {
      if (i >= MAX_RIPPLES) return;
      const base = i * 4;
      this.rippleBuffer[base] = ripple.x;
      this.rippleBuffer[base + 1] = ripple.y;
      this.rippleBuffer[base + 2] = ripple.start;
      this.rippleBuffer[base + 3] = ripple.strength;
    });
  }

  /* ---------------------------------------------------------------- *
   * Setup
   * ---------------------------------------------------------------- */

  private uniform(program: WebGLProgram, name: string) {
    let cache = this.uniforms.get(program);
    if (!cache) this.uniforms.set(program, (cache = new Map()));
    if (!cache.has(name)) cache.set(name, this.gl.getUniformLocation(program, name));
    return cache.get(name) ?? null;
  }

  private link(vertexSource: string, fragmentSource: string): WebGLProgram {
    const gl = this.gl;
    const program = gl.createProgram();
    if (!program) throw new Error("could not create program");

    const vertex = this.compile(gl.VERTEX_SHADER, vertexSource);
    const fragment = this.compile(gl.FRAGMENT_SHADER, fragmentSource);
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    // The shaders are only needed until the program is linked.
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(`shader link failed: ${log}`);
    }
    return program;
  }

  private compile(type: number, source: string): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type);
    if (!shader) throw new Error("could not create shader");
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`shader compile failed: ${log}`);
    }
    return shader;
  }

  private createQuad(): WebGLVertexArrayObject {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    if (!vao) throw new Error("could not create VAO");
    gl.bindVertexArray(vao);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    return vao;
  }

  /**
   * Motes are uploaded once and never touched again — position, depth, size
   * and twinkle phase are baked in, and the vertex shader derives every
   * frame's placement from them.
   */
  private createStars(): WebGLVertexArrayObject {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    if (!vao) throw new Error("could not create VAO");
    gl.bindVertexArray(vao);

    const seeds = new Float32Array(this.starCount * 2);
    const depths = new Float32Array(this.starCount);
    const character = new Float32Array(this.starCount * 2);

    for (let i = 0; i < this.starCount; i += 1) {
      seeds[i * 2] = Math.random();
      seeds[i * 2 + 1] = Math.random();
      depths[i] = Math.random();
      // Nine in ten are faint motes; the rest carry the field's bright points.
      const bright = Math.random() > 0.9;
      character[i * 2] = bright ? 0.7 + Math.random() * 0.3 : 0.12 + Math.random() * 0.4;
      character[i * 2 + 1] = Math.random();
    }

    const attach = (data: Float32Array, location: number, size: number) => {
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
    };

    attach(seeds, 0, 2);
    attach(depths, 1, 1);
    attach(character, 2, 2);

    gl.bindVertexArray(null);
    return vao;
  }

  private createNebulaTarget() {
    const gl = this.gl;
    const texture = gl.createTexture();
    if (!texture) throw new Error("could not create texture");
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA, NEBULA_SIZE, NEBULA_SIZE, 0,
      gl.RGBA, gl.UNSIGNED_BYTE, null,
    );
    // Linear filtering is what lets a 320px field upscale to a full screen
    // without showing its own resolution.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const fbo = gl.createFramebuffer();
    if (!fbo) throw new Error("could not create framebuffer");
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0,
    );
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { texture, fbo };
  }
}

/**
 * Pick a workload the device can actually sustain. A phone that is already
 * short on cores should not be asked to hold a full-fat particle field.
 */
export function ambienceProfile() {
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };
  const cores = navigator.hardwareConcurrency ?? 8;
  const memory = nav.deviceMemory ?? 8;

  if (cores <= 4 || memory <= 4) {
    return { starCount: 180, octaves: 3, dprCap: 1 };
  }
  if (cores <= 8) {
    return { starCount: 320, octaves: 4, dprCap: 1.25 };
  }
  return { starCount: 460, octaves: 4, dprCap: 1.5 };
}
