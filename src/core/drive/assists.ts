import type { DriveInput } from './drivetrain';

/** Sürüş yardımcıları (ayarlardan açılıp kapanır) */
export type Assists = {
  /** Çekiş kontrolü: arka tekerlek patinajında gazı kısar */
  tractionControl: boolean;
  /** Direksiyon yardımı: kuyruk savrulurken otomatik ters direksiyon */
  steeringAssist: boolean;
};

export const DEFAULT_ASSISTS: Assists = { tractionControl: false, steeringAssist: true };

/** Çekiş kontrolünün gazı en fazla bu orana kadar kısması */
const TC_MIN_THROTTLE = 0.25;
/** Patinaj hızı (m/s) bu değerde gaz TC_MIN_THROTTLE'a iner */
const TC_FULL_CUT_SLIP = 5;
/** Ters direksiyon kazancı: gövde kayma açısı (rad) başına eklenen direksiyon (-1..1) */
const COUNTER_STEER_GAIN = 1.6;
/** Bu boyuna hızın altında yardım yok (m/s) */
const ASSIST_MIN_SPEED = 6;
/** Yardımın direksiyona ekleyebileceği azami miktar */
const COUNTER_STEER_MAX = 0.6;

export type AssistContext = {
  forwardSpeed: number;
  lateralSpeed: number;
  /** Arka tekerlek patinaj hızı (m/s) */
  slipSpeed: number;
};

/**
 * Oyuncu girişine yardımcıları uygular; saf fonksiyon. Oyuncunun kendi direksiyonu korunur,
 * yardım yalnız kayma yönüne doğru ek bir düzeltme ekler.
 */
export function applyAssists(input: DriveInput, ctx: AssistContext, assists: Assists): DriveInput {
  let { throttle, steer } = input;
  if (assists.tractionControl && ctx.slipSpeed > 0.3) {
    const cut = Math.min(1, ctx.slipSpeed / TC_FULL_CUT_SLIP);
    throttle *= 1 - cut * (1 - TC_MIN_THROTTLE);
  }
  if (assists.steeringAssist && ctx.forwardSpeed > ASSIST_MIN_SPEED) {
    // Hız vektörü gövdenin soluna kayıyorsa (β>0) sola, sağına kayıyorsa sağa direksiyon
    const beta = Math.atan2(ctx.lateralSpeed, ctx.forwardSpeed);
    const add = Math.max(-COUNTER_STEER_MAX, Math.min(COUNTER_STEER_MAX, beta * COUNTER_STEER_GAIN));
    steer = Math.max(-1, Math.min(1, steer + add));
  }
  return { ...input, throttle, steer };
}
