import {
  DoubleSide,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Vector2,
  type Material,
} from 'three';
import type { BrakeConfig, TireConfig, WheelConfig, WheelFinish } from '../../../core/wheels/types';
import { rotorMap, sidewallMap, treadNormalMap } from './textures';

/** Kaplama -> materyal parametreleri. Boyalı kaplamalar renk alır. */
const FINISH: Record<
  Exclude<WheelFinish, 'painted' | 'two_tone'>,
  { color: string; metalness: number; roughness: number }
> = {
  chrome: { color: '#ffffff', metalness: 1, roughness: 0.04 },
  polished: { color: '#d9dbe0', metalness: 1, roughness: 0.16 },
  gunmetal: { color: '#3d4046', metalness: 0.85, roughness: 0.32 },
  matte_black: { color: '#121214', metalness: 0.3, roughness: 0.7 },
};
const PAINTED = { metalness: 0.2, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.06 };
const MACHINED_LIP = FINISH.polished;

const TIRE = { color: '#1a1a1c', roughness: 0.88, treadRoughness: 0.93, normalScale: 0.9 };
const BRAKE = {
  disc: { metalness: 0.85, roughness: 0.38 },
  hat: { color: '#2a2b2e', metalness: 0.6, roughness: 0.5 },
  caliper: { metalness: 0.2, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08 },
};

export type WheelMaterials = {
  face: Material;
  lip: Material;
  chrome: Material;
  tireSide: Material;
  tireSideOuter: Material;
  tread: Material;
};

export type BrakeMaterials = { disc: Material; hat: Material; caliper: Material };

function finishMaterial(finish: WheelFinish, color: string): Material {
  if (finish === 'painted' || finish === 'two_tone')
    return new MeshPhysicalMaterial({ ...PAINTED, color, side: DoubleSide });
  return new MeshStandardMaterial({ ...FINISH[finish], side: DoubleSide });
}

/** Bir aksın jant + lastik materyalleri. Çağıran dispose etmekten sorumludur. */
export function createWheelMaterials(w: WheelConfig, t: TireConfig): WheelMaterials {
  const face = finishMaterial(w.finish, w.color);
  const lip =
    w.finish === 'two_tone'
      ? new MeshStandardMaterial({ ...MACHINED_LIP, side: DoubleSide })
      : finishMaterial(w.finish, w.color);
  return {
    face,
    lip,
    chrome: new MeshStandardMaterial({ ...FINISH.chrome }),
    tireSide: new MeshStandardMaterial({ color: TIRE.color, roughness: TIRE.roughness }),
    tireSideOuter: new MeshStandardMaterial({
      color: '#ffffff',
      map: sidewallMap(t.sidewall),
      roughness: TIRE.roughness,
    }),
    tread: new MeshStandardMaterial({
      color: TIRE.color,
      roughness: TIRE.treadRoughness,
      normalMap: treadNormalMap(t.type),
      normalScale: new Vector2(TIRE.normalScale, TIRE.normalScale),
    }),
  };
}

export function createBrakeMaterials(b: BrakeConfig): BrakeMaterials {
  return {
    disc: new MeshStandardMaterial({ ...BRAKE.disc, map: rotorMap(b.rotor) }),
    hat: new MeshStandardMaterial({ ...BRAKE.hat }),
    caliper: new MeshPhysicalMaterial({ ...BRAKE.caliper, color: b.caliperColor }),
  };
}

/** Dokular paylaşımlı önbellekte; sadece materyaller atılır. */
export function disposeMaterials(m: Record<string, Material>): void {
  for (const mat of Object.values(m)) mat.dispose();
}
