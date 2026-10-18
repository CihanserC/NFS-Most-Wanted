import { glassOpacity, type GlassConfig, type LightingConfig } from '../../core/stance/stance';
import { BackSide, Color, MeshPhysicalMaterial, MeshStandardMaterial, type Material } from 'three';
import { DEFAULT_PAINT } from '../../core/paint/paint';
import { createCarPaintMaterial, type CarPaintMaterial } from './carPaintMaterial';
import { materialConfig as c } from './materialConfig';
import type { VinylUniforms } from './vinylUniforms';

export type CarMaterials = {
  paint: Record<string, CarPaintMaterial>;
  chrome: MeshStandardMaterial;
  aluminum: MeshStandardMaterial;
  rubber: MeshStandardMaterial;
  blackTrim: MeshStandardMaterial;
  carbon: MeshPhysicalMaterial;
  vinylTop: MeshPhysicalMaterial;
  glass: MeshPhysicalMaterial;
  underbody: MeshStandardMaterial;
  /** İç yüzeyi görünen kutular (motor bölmesi, kabin) için. */
  cavity: MeshStandardMaterial;
  interior: MeshStandardMaterial;
  engineBlock: MeshStandardMaterial;
  engineAccent: MeshPhysicalMaterial;
  cage: MeshStandardMaterial;
  headlightLens: MeshStandardMaterial;
  ledHalo: MeshStandardMaterial;
  tailLens: MeshStandardMaterial;
  tailSmoked: MeshStandardMaterial;
  ledStrip: MeshStandardMaterial;
};

export function createCarMaterials(paintZones: string[], vinyl: VinylUniforms): CarMaterials {
  const paint = Object.fromEntries(
    paintZones.map((zone) => [zone, createCarPaintMaterial(`paint_${zone}`, DEFAULT_PAINT, vinyl)]),
  );
  return {
    paint,
    chrome: new MeshStandardMaterial({ ...c.chrome, name: 'mat_chrome' }),
    aluminum: new MeshStandardMaterial({ ...c.aluminum, name: 'mat_aluminum' }),
    rubber: new MeshStandardMaterial({ ...c.rubber, name: 'mat_rubber' }),
    blackTrim: new MeshStandardMaterial({ ...c.blackTrim, name: 'mat_black_trim' }),
    carbon: new MeshPhysicalMaterial({ ...c.carbon, name: 'mat_carbon' }),
    vinylTop: new MeshPhysicalMaterial({ ...c.vinylTop, name: 'mat_vinyl_top' }),
    glass: new MeshPhysicalMaterial({
      ...c.glass,
      transparent: true,
      depthWrite: false,
      name: 'mat_glass',
    }),
    underbody: new MeshStandardMaterial({ ...c.underbody, name: 'mat_underbody' }),
    cavity: new MeshStandardMaterial({ ...c.underbody, side: BackSide, name: 'mat_cavity' }),
    interior: new MeshStandardMaterial({ ...c.interior, name: 'mat_interior' }),
    engineBlock: new MeshStandardMaterial({ ...c.engineBlock, name: 'mat_engine_block' }),
    engineAccent: new MeshPhysicalMaterial({ ...c.engineAccent, name: 'mat_engine_accent' }),
    cage: new MeshStandardMaterial({ ...c.cage, name: 'mat_cage' }),
    headlightLens: new MeshStandardMaterial({ ...c.headlightLens, name: 'mat_headlight_lens' }),
    ledHalo: new MeshStandardMaterial({ ...c.ledHalo, name: 'mat_led_halo' }),
    tailLens: new MeshStandardMaterial({ ...c.tailLens, name: 'mat_taillight_lens' }),
    tailSmoked: new MeshStandardMaterial({ ...c.tailSmoked, name: 'mat_taillight_smoked' }),
    ledStrip: new MeshStandardMaterial({ ...c.ledStrip, name: 'mat_led_strip' }),
  };
}

export function disposeCarMaterials(m: CarMaterials): void {
  for (const value of Object.values(m) as (Material | Record<string, Material>)[]) {
    if ('dispose' in value && typeof value.dispose === 'function') value.dispose();
    else for (const mat of Object.values(value)) mat.dispose();
  }
}

/** Boya bölgesi manifestte yoksa gövde boyasına düşer. */
export function paintFor(m: CarMaterials, zone: string): CarPaintMaterial {
  const mat = m.paint[zone] ?? m.paint.body ?? Object.values(m.paint)[0];
  if (!mat) throw new Error('Araçta hiç boya bölgesi yok');
  return mat;
}

/** Cam filmi ve far rengini materyallere uygular (paylaşılan materyaller yerinde güncellenir). */
export function applyLook(m: CarMaterials, glass: GlassConfig, lighting: LightingConfig): void {
  m.glass.opacity = glassOpacity(glass.tint);
  m.glass.color.set(glass.color);
  const headlight = new Color(lighting.headlightColor);
  m.headlightLens.emissive.copy(headlight);
  m.ledHalo.emissive.copy(headlight);
}
