export const WHEEL_STYLES = [
  'classic_5spoke',
  'steel_dogdish',
  'mesh',
  'deep_dish_3pc',
  'modern_multispoke',
  'drag',
] as const;
export type WheelStyle = (typeof WHEEL_STYLES)[number];

export const WHEEL_FINISHES = [
  'chrome',
  'polished',
  'gunmetal',
  'matte_black',
  'painted',
  'two_tone',
] as const;
export type WheelFinish = (typeof WHEEL_FINISHES)[number];

/** Rengi kullanan kaplamalar (boyalı yüzey). */
export const COLORED_FINISHES: readonly WheelFinish[] = ['painted', 'two_tone'];

export const TIRE_SIDEWALLS = ['black', 'raised_white_letters', 'whitewall'] as const;
export type TireSidewall = (typeof TIRE_SIDEWALLS)[number];

export const TIRE_TYPES = ['street', 'semi_slick', 'drag_radial'] as const;
export type TireType = (typeof TIRE_TYPES)[number];
/** Drag radial sadece arka akste. */
export const REAR_ONLY_TIRE_TYPES: readonly TireType[] = ['drag_radial'];

export const ROTOR_TYPES = ['plain', 'drilled', 'slotted'] as const;
export type RotorType = (typeof ROTOR_TYPES)[number];

export const CALIPER_PISTONS = [2, 4, 6] as const;
export type CaliperPistons = (typeof CALIPER_PISTONS)[number];

export type Axle = 'front' | 'rear';
export const AXLES: readonly Axle[] = ['front', 'rear'];

export type WheelConfig = {
  style: WheelStyle;
  /** inç, tam sayı */
  diameterIn: number;
  /** inç, 0.5 adım */
  widthIn: number;
  /** ET (mm). Pozitif: jant içe kayar. */
  offsetMm: number;
  /** Dudak (dish) derinliği, inç. Stile göre sınırlı. */
  lipIn: number;
  /** Kol / delik sayısı (destekleyen stillerde). */
  spokes: number;
  finish: WheelFinish;
  /** Boyalı / iki tonlu kaplama rengi. */
  color: string;
  centerCap: boolean;
  lugNuts: boolean;
};

export type TireConfig = {
  widthMm: number;
  /** Yanak oranı, % */
  aspect: number;
  sidewall: TireSidewall;
  type: TireType;
};

export type BrakeConfig = {
  discMm: number;
  rotor: RotorType;
  pistons: CaliperPistons;
  caliperColor: string;
};

export type AxlePair<T> = { front: T; rear: T };

/** Jant + lastik + fren: BuildState'in tekerlek kısmı. */
export type FitmentState = {
  wheels: AxlePair<WheelConfig>;
  tires: AxlePair<TireConfig>;
  brakes: BrakeConfig;
};
