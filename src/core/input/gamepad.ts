/** Standart eşlemeli gamepad (Xbox/PlayStation düzeni) için saf eşleme mantığı. */
export type PadSnapshot = {
  axes: readonly number[];
  buttons: readonly { pressed: boolean; value: number }[];
};

/** Standart eşleme düğme indeksleri */
export const PAD = {
  A: 0,
  B: 1,
  X: 2,
  Y: 3,
  LT: 6,
  RT: 7,
  START: 9,
  UP: 12,
  DOWN: 13,
  LEFT: 14,
  RIGHT: 15,
} as const;

export const STICK_DEADZONE = 0.18;
/** Çubuğun menüde yön sayılması için eşik */
export const STICK_MENU_THRESHOLD = 0.6;
/** Menüde tuş tekrarı: ilk gecikme ve sonraki aralık (ms) */
export const REPEAT_FIRST_MS = 380;
export const REPEAT_NEXT_MS = 130;

const button = (pad: PadSnapshot, i: number) => pad.buttons[i]?.pressed ?? false;
const axis = (pad: PadSnapshot, i: number) => pad.axes[i] ?? 0;

/** Ölü bölgeyi atıp kalan aralığı −1..1'e yayar. */
export function deadzone(value: number, zone = STICK_DEADZONE): number {
  const a = Math.abs(value);
  if (a <= zone) return 0;
  return Math.sign(value) * Math.min(1, (a - zone) / (1 - zone));
}

export type MenuKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight' | 'Enter' | 'Escape';
export type PadKeyCode = 'KeyC' | 'KeyR' | 'Escape';

/** Önceki kareden taşınan durum: tuş tekrarı zamanlaması ve düğme kenar algılama */
export type PadState = {
  /** Yön -> son tetiklenme zamanı (ms); basılı değilse yok */
  held: Partial<Record<MenuKey, { lastFire: number; repeated: boolean }>>;
  /** Önceki karedeki düğme basılılığı (kenar algılama) */
  pressed: Record<number, boolean>;
};

export const initialPadState = (): PadState => ({ held: {}, pressed: {} });

function edge(pad: PadSnapshot, state: PadState, index: number): boolean {
  const now = button(pad, index);
  const was = state.pressed[index] ?? false;
  return now && !was;
}

function rememberButtons(pad: PadSnapshot, indices: readonly number[]): Record<number, boolean> {
  return Object.fromEntries(indices.map((i) => [i, button(pad, i)]));
}

const TRACKED = [PAD.A, PAD.B, PAD.X, PAD.Y, PAD.START] as const;

/**
 * Menü gezintisi: D-pad / sol çubuk yön tuşlarına (ilk gecikme + tekrar), A → Enter, B ve Start → Escape.
 * Her çağrıda tetiklenmesi gereken tuşları ve yeni durumu döndürür (now: ms).
 */
export function menuKeys(
  pad: PadSnapshot,
  state: PadState,
  now: number,
): { keys: MenuKey[]; state: PadState } {
  const keys: MenuKey[] = [];
  const stickX = axis(pad, 0);
  const stickY = axis(pad, 1);
  const active: Record<'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight', boolean> = {
    ArrowUp: button(pad, PAD.UP) || stickY < -STICK_MENU_THRESHOLD,
    ArrowDown: button(pad, PAD.DOWN) || stickY > STICK_MENU_THRESHOLD,
    ArrowLeft: button(pad, PAD.LEFT) || stickX < -STICK_MENU_THRESHOLD,
    ArrowRight: button(pad, PAD.RIGHT) || stickX > STICK_MENU_THRESHOLD,
  };
  const held: PadState['held'] = {};
  for (const key of Object.keys(active) as (keyof typeof active)[]) {
    if (!active[key]) continue;
    const previous = state.held[key];
    if (!previous) {
      keys.push(key);
      held[key] = { lastFire: now, repeated: false };
    } else if (now - previous.lastFire >= (previous.repeated ? REPEAT_NEXT_MS : REPEAT_FIRST_MS)) {
      keys.push(key);
      held[key] = { lastFire: now, repeated: true };
    } else held[key] = previous;
  }
  if (edge(pad, state, PAD.A)) keys.push('Enter');
  if (edge(pad, state, PAD.B) || edge(pad, state, PAD.START)) keys.push('Escape');
  return { keys, state: { held, pressed: rememberButtons(pad, TRACKED) } };
}

export type DriveAxes = { steer: number; throttle: number; brake: number; handbrake: boolean };

/** Sürüş girişi: sol çubuk direksiyon (sol +), RT gaz, LT fren, A/X el freni. */
export function driveAxes(pad: PadSnapshot): DriveAxes {
  return {
    // 0 - x: eksen tam ortadayken -0 yerine 0 üretir
    steer: 0 - deadzone(axis(pad, 0)),
    throttle: Math.max(0, Math.min(1, pad.buttons[PAD.RT]?.value ?? 0)),
    brake: Math.max(0, Math.min(1, pad.buttons[PAD.LT]?.value ?? 0)),
    handbrake: button(pad, PAD.A) || button(pad, PAD.X),
  };
}

/** Sürüş kısayolları (kenar tetikli): Y kamera (C), B pistte düzelt (R), Start duraklat (Esc). */
export function driveKeys(
  pad: PadSnapshot,
  state: PadState,
): { codes: PadKeyCode[]; state: PadState } {
  const codes: PadKeyCode[] = [];
  if (edge(pad, state, PAD.Y)) codes.push('KeyC');
  if (edge(pad, state, PAD.B)) codes.push('KeyR');
  if (edge(pad, state, PAD.START)) codes.push('Escape');
  return { codes, state: { held: {}, pressed: rememberButtons(pad, TRACKED) } };
}
