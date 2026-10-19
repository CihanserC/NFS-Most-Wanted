import { describe, expect, it } from 'vitest';
import { applyAssists, DEFAULT_ASSISTS } from './assists';

const input = { throttle: 1, brake: 0, steer: 0, handbrake: false };
const none = { tractionControl: false, steeringAssist: false };

describe('applyAssists', () => {
  it('kapalıyken girişi değiştirmez', () => {
    expect(applyAssists(input, { forwardSpeed: 20, lateralSpeed: 5, slipSpeed: 4 }, none)).toEqual(input);
  });
  it('sola kayarken sola ters direksiyon ekler', () => {
    const out = applyAssists(input, { forwardSpeed: 20, lateralSpeed: 4, slipSpeed: 0 }, DEFAULT_ASSISTS);
    expect(out.steer).toBeGreaterThan(0);
  });
  it('düşük hızda müdahale etmez', () => {
    const out = applyAssists(input, { forwardSpeed: 2, lateralSpeed: 2, slipSpeed: 0 }, DEFAULT_ASSISTS);
    expect(out.steer).toBe(0);
  });
  it('çekiş kontrolü patinajda gazı kısar ama sıfırlamaz', () => {
    const out = applyAssists(input, { forwardSpeed: 10, lateralSpeed: 0, slipSpeed: 8 }, { ...none, tractionControl: true });
    expect(out.throttle).toBeLessThan(1);
    expect(out.throttle).toBeGreaterThanOrEqual(0.25);
  });
});
