import type { PaintConfig } from '../paint/types';

/**
 * Aracın tüm modifiye durumunu tutan serileştirilebilir obje.
 * Yeni alanlar ilgili fazlarda yeni sürüm + migration ile eklenir (bkz. migrate.ts).
 * v1: parts · v2: paint
 */
export type BuildState = {
  version: 2;
  carId: string;
  name: string;
  /** slot id -> seçenek id */
  parts: Record<string, string>;
  /** boya bölgesi -> boya */
  paint: Record<string, PaintConfig>;
  updatedAt: string;
};

export const CURRENT_BUILD_VERSION = 2;
