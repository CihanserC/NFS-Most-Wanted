export const VINYL_SIDES = ['left', 'right', 'top', 'front', 'rear'] as const;
export type VinylSide = (typeof VINYL_SIDES)[number];

export const MASK_MODES = ['none', 'mask', 'cutout'] as const;
export type MaskMode = (typeof MASK_MODES)[number];

/** Spesifikasyon §7.2 katman modeli. */
export type VinylLayer = {
  id: string;
  /** Şekil kütüphanesinden */
  shapeId: string;
  side: VinylSide;
  /** Projeksiyon yüzeyinde, 0..1 (u sağa, v yukarı; yüzeye dışarıdan bakarken) */
  position: [number, number];
  rotationDeg: number;
  scale: [number, number];
  skew: [number, number];
  color: string;
  /** 0..1 */
  opacity: number;
  flipX: boolean;
  flipY: boolean;
  /** sol <-> sağ simetri (üst/ön/arkada araç orta çizgisine göre ayna) */
  mirrorToOppositeSide: boolean;
  /** Faz 6: altındaki katmanı kırpma. Faz 5'te saklanır ama çizimde yok sayılır. */
  maskMode: MaskMode;
  visible: boolean;
  locked: boolean;
  groupId?: string;
  /** Yazı katmanı (shapeId 'text'): metin ve çizgi fontu */
  text?: string;
  fontId?: string;
};
