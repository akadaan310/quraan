/**
 * GLSL for the celestial atmosphere.
 *
 * Two passes. The nebula is a full-screen quad of value-noise fbm, rendered
 * into a small offscreen texture and upscaled — it breathes over tens of
 * seconds, so refreshing it a few times a second is indistinguishable from
 * every frame and costs a fraction of the fill rate. The starfield is a
 * single `POINTS` draw whose motion lives entirely in the vertex shader, so
 * the CPU uploads nothing per frame but a handful of uniforms.
 */

export const QUAD_VERTEX = `#version 300 es
in vec2 aPosition;
out vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

/** Shared noise. Hash-based value noise — no textures, no dependent reads. */
const NOISE = `
float hash(vec2 p) {
  p = fract(p * vec2(233.34, 851.73));
  p += dot(p, p + 23.45);
  return fract(p.x * p.y);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p, int octaves) {
  float sum = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 5; i++) {
    if (i >= octaves) break;
    sum += amplitude * valueNoise(p);
    p *= 2.03;
    amplitude *= 0.5;
  }
  return sum;
}`;

export const NEBULA_FRAGMENT = `#version 300 es
precision mediump float;

in vec2 vUv;
out vec4 fragColor;

uniform float uTime;
uniform vec2  uAspect;
uniform int   uOctaves;

/** 0 = moving briskly through the page, 1 = settled on one verse. */
uniform float uCalm;
/** Sustained-ness of the page's recitation: elongation and nasalisation. */
uniform float uFlow;
/** Percussive-ness: echoing and throat-heavy consonants. */
uniform float uGrain;
/** Sibilance, which lifts the palette toward cooler light. */
uniform float uBrightness;
/** How much of the page locks into a single rhyme ending. */
uniform float uRhymeRun;

${NOISE}

void main() {
  vec2 p = (vUv - 0.5) * uAspect;

  // Turbulence slows as the reader settles, so a page held for a long time
  // comes to rest rather than continuing to churn behind the script.
  float drift = uTime * mix(0.055, 0.012, uCalm);

  // Flowing passages get broader, softer cells; percussive ones get finer,
  // more agitated structure.
  float scale = mix(2.6, 1.55, uFlow) + uGrain * 1.6;

  vec2 warp = vec2(
    fbm(p * scale + vec2(drift, -drift * 0.7), uOctaves),
    fbm(p * scale + vec2(-drift * 0.8, drift * 1.1) + 17.3, uOctaves)
  );
  float cloud = fbm(p * scale * 0.85 + warp * 1.35, uOctaves);

  // A slow shared pulse. Where a page rhymes insistently, the pulse locks to
  // that insistence and deepens.
  float breath = 0.5 + 0.5 * sin(uTime * mix(0.14, 0.07, uCalm));
  cloud *= 0.72 + 0.34 * breath * (0.6 + uRhymeRun * 0.6);

  // The palette stays within the reader's obsidian and gold: a cold slate
  // base, a warm amber core, and a faint violet in the deepest folds.
  vec3 slate  = vec3(0.071, 0.086, 0.153);
  vec3 amber  = vec3(0.556, 0.404, 0.176);
  vec3 violet = vec3(0.145, 0.129, 0.263);

  float warmth = smoothstep(0.34, 0.86, cloud);
  vec3 colour = mix(slate, violet, smoothstep(0.1, 0.55, cloud));
  colour = mix(colour, amber, warmth * (0.34 + uCalm * 0.46));

  // Sibilant pages read a shade cooler and brighter.
  colour += vec3(0.02, 0.03, 0.055) * uBrightness;

  // Hold the centre darker than the edges so the script always sits on the
  // quietest part of the field.
  float centreFalloff = smoothstep(0.08, 0.95, length(p) * 0.82);
  float alpha = cloud * (0.16 + 0.2 * centreFalloff) * (0.62 + 0.5 * uCalm);

  fragColor = vec4(colour * alpha, alpha);
}`;

export const STAR_VERTEX = `#version 300 es
precision highp float;

/** Unit-square home position of the mote. */
in vec2  aSeed;
/** Parallax depth, 0 far … 1 near. */
in float aDepth;
/** Per-mote size and twinkle phase. */
in vec2  aCharacter;

uniform float uTime;
uniform vec2  uResolution;
uniform float uDpr;
/** Signed reading velocity: positive moves toward the end of the Muṣḥaf. */
uniform float uVelocity;
uniform float uCalm;
uniform float uDensity;

out float vAlpha;
out float vWarm;

void main() {
  // Nearer layers drift faster, which is what reads as depth.
  float parallax = mix(0.35, 1.0, aDepth);

  // The field answers the reader's pace: turning pages quickly pushes the
  // motes, settling lets them come to rest.
  float pace = mix(0.012, 0.0035, uCalm);
  float x = aSeed.x - uTime * pace * parallax * 0.35 - uVelocity * parallax * 0.12;
  float y = aSeed.y - uTime * pace * parallax * 0.22 + uVelocity * parallax * 0.03;

  // Wrap in the unit square so the field is endless in every direction.
  vec2 wrapped = fract(vec2(x, y));
  vec2 clip = wrapped * 2.0 - 1.0;

  gl_Position = vec4(clip, 0.0, 1.0);

  float twinkle = 0.62 + 0.38 * sin(uTime * (0.5 + aCharacter.y * 1.4) + aCharacter.y * 31.0);
  // Dense, short-versed pages carry a slightly busier sky.
  vAlpha = aCharacter.x * twinkle * (0.55 + 0.45 * aDepth) * (0.78 + uDensity * 0.3);
  vWarm = aDepth;

  gl_PointSize = (0.7 + aCharacter.x * 2.3) * mix(0.75, 1.25, aDepth) * uDpr;
}`;

export const STAR_FRAGMENT = `#version 300 es
precision mediump float;

in float vAlpha;
in float vWarm;
out vec4 fragColor;

uniform float uCalm;
/** Up to six live touch ripples: xy in clip space, z start time, w strength. */
uniform vec4  uRipples[6];
uniform float uTime;
uniform vec2  uResolution;

void main() {
  // Round the point sprite off with a soft edge; a square mote reads as a bug.
  vec2 offset = gl_PointCoord - 0.5;
  float d = length(offset);
  float core = smoothstep(0.5, 0.06, d);
  if (core <= 0.001) discard;

  vec3 cool = vec3(0.863, 0.847, 0.800);
  vec3 warm = vec3(0.992, 0.953, 0.843);
  vec3 colour = mix(cool, warm, vWarm * 0.75 + uCalm * 0.25);

  float alpha = vAlpha * core;

  // A tap sends one low ring of gold outward through the field.
  vec2 clip = (gl_FragCoord.xy / uResolution) * 2.0 - 1.0;
  for (int i = 0; i < 6; i++) {
    vec4 ripple = uRipples[i];
    if (ripple.w <= 0.0) continue;
    float age = uTime - ripple.z;
    if (age < 0.0 || age > 2.4) continue;

    float radius = age * 0.85;
    float dist = distance(clip, ripple.xy);
    // Narrow band, fading with both age and distance travelled.
    float band = exp(-pow((dist - radius) * 7.0, 2.0));
    float decay = (1.0 - age / 2.4) * ripple.w;
    float lift = band * decay;

    alpha += lift * 0.85;
    colour = mix(colour, vec3(1.0, 0.886, 0.643), clamp(lift * 1.4, 0.0, 1.0));
  }

  fragColor = vec4(colour * alpha, alpha);
}`;

export const COMPOSITE_FRAGMENT = `#version 300 es
precision mediump float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uNebula;
uniform float uWarmth;
uniform vec2 uHalo;

void main() {
  vec4 nebula = texture(uNebula, vUv);

  // The parchment backlight the page rests on, deepening as the reader settles.
  vec2 centred = (vUv - vec2(0.5, 0.46)) * vec2(1.35, 1.0);
  float halo = exp(-dot(centred, centred) * uHalo.x);
  vec3 glow = vec3(0.831, 0.675, 0.306) * halo * uHalo.y * uWarmth;

  fragColor = vec4(nebula.rgb + glow, max(nebula.a, halo * uHalo.y * uWarmth));
}`;
