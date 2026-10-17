export const PAINT_TYPES = [
  'solid',
  'metallic',
  'pearl',
  'candy',
  'matte',
  'satin',
  'chrome',
  'chameleon',
] as const;

export type PaintType = (typeof PAINT_TYPES)[number];

/** Bir boya bölgesinin (veya boyanabilir parçanın) tüm ayarları. JSON'a serileşir. */
export type PaintConfig = {
  type: PaintType;
  /** Ana renk (sRGB hex). Kromda renk tonu. */
  color: string;
  /** Perleskan renk kayması / kameleon 2. renk. */
  secondaryColor: string;
  /** Kameleon 3. renk. */
  tertiaryColor: string;
  /** 0 = ince pul, 1 = iri pul */
  flakeSize: number;
  /** 0..1 */
  flakeDensity: number;
  flakeColor: string;
  /** 0 = mat vernik, 1 = ayna gibi vernik */
  gloss: number;
};

/** Pul (flake) kullanan boya tipleri; UI pul kontrollerini sadece bunlarda gösterir. */
export const FLAKE_PAINT_TYPES: readonly PaintType[] = ['metallic', 'pearl', 'candy', 'chameleon'];
