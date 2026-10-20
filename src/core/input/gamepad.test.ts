import { describe, expect, it } from 'vitest';
import {
  deadzone,
  driveAxes,
  driveKeys,
  initialPadState,
  menuKeys,
  PAD,
  REPEAT_FIRST_MS,
  REPEAT_NEXT_MS,
  type PadSnapshot,
} from './gamepad';

/** Test için gamepad görüntüsü: basılı düğmeler ve eksenler. */
function pad(
  pressed: number[] = [],
  axes: number[] = [0, 0, 0, 0],
  values: Record<number, number> = {},
): PadSnapshot {
  return {
    axes,
    buttons: Array.from({ length: 17 }, (_, i) => ({
      pressed: pressed.includes(i) || (values[i] ?? 0) > 0.5,
      value: values[i] ?? (pressed.includes(i) ? 1 : 0),
    })),
  };
}

describe('gamepad: eksen', () => {
  it('ölü bölge küçük sapmayı yutar, kalanı −1..1 aralığına yayar', () => {
    expect(deadzone(0.1)).toBe(0);
    expect(deadzone(-0.18)).toBe(0);
    expect(deadzone(1)).toBe(1);
    expect(deadzone(-1)).toBe(-1);
    expect(deadzone(0.59)).toBeCloseTo((0.59 - 0.18) / 0.82, 5);
  });
});

describe('gamepad: menü gezintisi', () => {
  it('D-pad aşağı bir kez tetikler, basılı tutunca ilk gecikmeden sonra tekrarlar', () => {
    let state = initialPadState();
    const down = pad([PAD.DOWN]);
    let r = menuKeys(down, state, 0);
    expect(r.keys).toEqual(['ArrowDown']);
    state = r.state;
    r = menuKeys(down, state, REPEAT_FIRST_MS - 1);
    expect(r.keys).toEqual([]);
    state = r.state;
    r = menuKeys(down, state, REPEAT_FIRST_MS);
    expect(r.keys).toEqual(['ArrowDown']);
    state = r.state;
    r = menuKeys(down, state, REPEAT_FIRST_MS + REPEAT_NEXT_MS - 1);
    expect(r.keys).toEqual([]);
    r = menuKeys(down, r.state, REPEAT_FIRST_MS + REPEAT_NEXT_MS);
    expect(r.keys).toEqual(['ArrowDown']);
  });

  it('bırakıp tekrar basınca yeniden anında tetiklenir', () => {
    let r = menuKeys(pad([PAD.UP]), initialPadState(), 0);
    r = menuKeys(pad(), r.state, 50);
    expect(r.keys).toEqual([]);
    r = menuKeys(pad([PAD.UP]), r.state, 100);
    expect(r.keys).toEqual(['ArrowUp']);
  });

  it('sol çubuk eşiği aşınca yön verir, altında vermez', () => {
    expect(menuKeys(pad([], [0.5, 0, 0, 0]), initialPadState(), 0).keys).toEqual([]);
    expect(menuKeys(pad([], [0, 0.8, 0, 0]), initialPadState(), 0).keys).toEqual(['ArrowDown']);
    expect(menuKeys(pad([], [-0.9, 0, 0, 0]), initialPadState(), 0).keys).toEqual(['ArrowLeft']);
  });

  it('A → Enter, B ve Start → Escape yalnızca basış anında (kenar)', () => {
    let r = menuKeys(pad([PAD.A]), initialPadState(), 0);
    expect(r.keys).toEqual(['Enter']);
    r = menuKeys(pad([PAD.A]), r.state, 16);
    expect(r.keys).toEqual([]);
    expect(menuKeys(pad([PAD.B]), initialPadState(), 0).keys).toEqual(['Escape']);
    expect(menuKeys(pad([PAD.START]), initialPadState(), 0).keys).toEqual(['Escape']);
  });
});

describe('gamepad: sürüş', () => {
  it('çubuk sola → direksiyon +, tetikler gaz/fren, A veya X el freni', () => {
    const left = driveAxes(pad([], [-1, 0, 0, 0], { [PAD.RT]: 0.8, [PAD.LT]: 0.25 }));
    expect(left.steer).toBe(1);
    expect(left.throttle).toBeCloseTo(0.8);
    expect(left.brake).toBeCloseTo(0.25);
    expect(left.handbrake).toBe(false);
    expect(driveAxes(pad([], [0.6, 0, 0, 0])).steer).toBeLessThan(0);
    expect(driveAxes(pad([PAD.A])).handbrake).toBe(true);
    expect(driveAxes(pad([PAD.X])).handbrake).toBe(true);
    expect(driveAxes(pad([], [0.1, 0, 0, 0])).steer).toBe(0);
  });

  it('Y kamera, B pistte düzelt, Start duraklat: kenar tetikli', () => {
    let r = driveKeys(pad([PAD.Y, PAD.B, PAD.START]), initialPadState());
    expect(r.codes).toEqual(['KeyC', 'KeyR', 'Escape']);
    r = driveKeys(pad([PAD.Y, PAD.B, PAD.START]), r.state);
    expect(r.codes).toEqual([]);
    r = driveKeys(pad(), r.state);
    r = driveKeys(pad([PAD.Y]), r.state);
    expect(r.codes).toEqual(['KeyC']);
  });

  it('eksik düğme/eksen verisinde güvenli varsayılanlar', () => {
    const empty: PadSnapshot = { axes: [], buttons: [] };
    expect(driveAxes(empty)).toEqual({
      steer: 0,
      throttle: 0,
      brake: 0,
      handbrake: false,
      nitro: false,
    });
    expect(menuKeys(empty, initialPadState(), 0).keys).toEqual([]);
  });
});
