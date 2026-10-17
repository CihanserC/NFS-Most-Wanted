import type { PaintConfig } from '../paint/types';
import type { VinylLayer } from '../vinyl/types';
import type { AxlePair, BrakeConfig, TireConfig, WheelConfig } from '../wheels/types';

/**
 * Aracın tüm modifiye durumunu tutan serileştirilebilir obje.
 * Yeni alanlar ilgili fazlarda yeni sürüm + migration ile eklenir (bkz. migrate.ts).
 * v1: parts · v2: paint · v3: wheels, tires, brakes · v4: vinyl
 */
export type BuildState = {
  version: 4;
  carId: string;
  name: string;
  /** slot id -> seçenek id */
  parts: Record<string, string>;
  /** boya bölgesi -> boya */
  paint: Record<string, PaintConfig>;
  wheels: AxlePair<WheelConfig>;
  tires: AxlePair<TireConfig>;
  brakes: BrakeConfig;
  /** Alttan üste vinil katmanları (son eleman en üstte) */
  vinyl: VinylLayer[];
  updatedAt: string;
};

export const CURRENT_BUILD_VERSION = 4;
