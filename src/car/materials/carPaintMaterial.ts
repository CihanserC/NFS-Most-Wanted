import { Color, MeshPhysicalMaterial, type IUniform } from 'three';
import { paintMode, resolvePaint } from '../../core/paint/resolve';
import type { PaintConfig } from '../../core/paint/types';

type PaintUniforms = {
  uPaintMode: IUniform<number>;
  uFlakeScale: IUniform<number>;
  uFlakeDensity: IUniform<number>;
  uFlakeStrength: IUniform<number>;
  uFlakeTint: IUniform<number>;
  uFlakeColor: IUniform<Color>;
  uColor2: IUniform<Color>;
  uColor3: IUniform<Color>;
  uFresnel: IUniform<number>;
};

const MODE = {
  pearl: paintMode('pearl'),
  candy: paintMode('candy'),
  chameleon: paintMode('chameleon'),
};

/** Tüm araç boyaları aynı shader programını paylaşır; farklar uniform'larla gelir. */
const PROGRAM_KEY = 'car-paint-v1';

const VERTEX_HEAD = /* glsl */ `
varying vec3 vFlakePos;
`;
const VERTEX_BODY = /* glsl */ `
vFlakePos = transformed;
`;

const FRAGMENT_HEAD = /* glsl */ `
varying vec3 vFlakePos;
uniform int uPaintMode;
uniform float uFlakeScale;
uniform float uFlakeDensity;
uniform float uFlakeStrength;
uniform float uFlakeTint;
uniform vec3 uFlakeColor;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform float uFresnel;

float paintHash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
vec3 paintHash33(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}
`;

// normal_fragment_maps'ten sonra: normal (view uzayı) ve diffuseColor hazır,
// ışıklandırma henüz hesaplanmadı.
const FRAGMENT_BODY = /* glsl */ `
{
  float ndv = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
  float edge = 1.0 - ndv;

  if (uPaintMode == ${MODE.pearl}) {
    // Perleskan: sıyırma açısında ikinci renge kayma.
    diffuseColor.rgb = mix(diffuseColor.rgb, uColor2, pow(edge, 2.0) * uFresnel);
  } else if (uPaintMode == ${MODE.candy}) {
    // Candy: renkli şeffaf katman; dik bakışta parlak, kenarlarda koyu ve doygun.
    vec3 deep = diffuseColor.rgb * diffuseColor.rgb * 0.55;
    diffuseColor.rgb = mix(deep, diffuseColor.rgb, pow(ndv, 0.75 * uFresnel));
  } else if (uPaintMode == ${MODE.chameleon}) {
    // Kameleon: bakış açısına göre üç renk arası geçiş (+ iridescence).
    float t = clamp(edge * 1.35 * uFresnel, 0.0, 1.0);
    diffuseColor.rgb = t < 0.5
      ? mix(diffuseColor.rgb, uColor2, t * 2.0)
      : mix(uColor2, uColor3, (t - 0.5) * 2.0);
  }

  if (uFlakeDensity > 0.0 && uFlakeStrength > 0.0) {
    vec3 fp = vFlakePos * uFlakeScale;
    // Uzakta piksel başına çok sayıda pul düşer: aliasing yerine yumuşakça kaybolur.
    float fade = 1.0 - smoothstep(1.5, 4.0, length(fwidth(fp)));
    vec3 cell = floor(fp);
    if (fade > 0.0 && paintHash13(cell) < uFlakeDensity) {
      vec3 tilt = paintHash33(cell) * 2.0 - 1.0;
      normal = normalize(normal + tilt * uFlakeStrength * fade);
      diffuseColor.rgb = mix(diffuseColor.rgb, uFlakeColor, uFlakeTint * fade);
      metalnessFactor = mix(metalnessFactor, 1.0, 0.6 * fade);
      roughnessFactor = mix(roughnessFactor, 0.12, 0.6 * fade);
    }
  }
}
`;

function inject(src: string, anchor: string, code: string, where: 'before' | 'after'): string {
  if (!src.includes(anchor)) throw new Error(`Araç boyası shader'ı: "${anchor}" bulunamadı`);
  return src.replace(anchor, where === 'after' ? `${anchor}\n${code}` : `${code}\n${anchor}`);
}

export type CarPaintMaterial = MeshPhysicalMaterial & {
  userData: { paintUniforms: PaintUniforms };
};

export function createCarPaintMaterial(name: string, paint: PaintConfig): CarPaintMaterial {
  const uniforms: PaintUniforms = {
    uPaintMode: { value: 0 },
    uFlakeScale: { value: 1 },
    uFlakeDensity: { value: 0 },
    uFlakeStrength: { value: 0 },
    uFlakeTint: { value: 0 },
    uFlakeColor: { value: new Color() },
    uColor2: { value: new Color() },
    uColor3: { value: new Color() },
    uFresnel: { value: 0 },
  };
  const mat = new MeshPhysicalMaterial({ name }) as CarPaintMaterial;
  mat.userData.paintUniforms = uniforms;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = inject(shader.vertexShader, '#include <common>', VERTEX_HEAD, 'after');
    shader.vertexShader = inject(
      shader.vertexShader,
      '#include <begin_vertex>',
      VERTEX_BODY,
      'after',
    );
    shader.fragmentShader = inject(
      shader.fragmentShader,
      '#include <common>',
      FRAGMENT_HEAD,
      'after',
    );
    shader.fragmentShader = inject(
      shader.fragmentShader,
      '#include <normal_fragment_maps>',
      FRAGMENT_BODY,
      'after',
    );
  };
  mat.customProgramCacheKey = () => PROGRAM_KEY;
  applyPaint(mat, paint);
  return mat;
}

/** PaintConfig'i materyale uygular. Sadece uniform/parametre günceller; tip değişimi
 *  (ör. iridescence açılıp kapanması) three tarafından otomatik yeniden derlenir. */
export function applyPaint(mat: CarPaintMaterial, paint: PaintConfig): void {
  const r = resolvePaint(paint);
  const u = mat.userData.paintUniforms;
  mat.color.set(r.color);
  mat.metalness = r.metalness;
  mat.roughness = r.roughness;
  mat.clearcoat = r.clearcoat;
  mat.clearcoatRoughness = r.clearcoatRoughness;
  mat.sheen = r.sheen;
  mat.sheenColor.set(r.sheenColor);
  mat.sheenRoughness = 0.5;
  mat.iridescence = r.iridescence;
  mat.iridescenceIOR = r.iridescenceIOR;
  mat.iridescenceThicknessRange = [...r.iridescenceThicknessRange];
  u.uPaintMode.value = r.mode;
  u.uFlakeScale.value = r.flakeScale;
  u.uFlakeDensity.value = r.flakeDensity;
  u.uFlakeStrength.value = r.flakeStrength;
  u.uFlakeTint.value = r.flakeTint;
  u.uFlakeColor.value.set(r.flakeColor);
  u.uColor2.value.set(r.color2);
  u.uColor3.value.set(r.color3);
  u.uFresnel.value = r.fresnel;
}
