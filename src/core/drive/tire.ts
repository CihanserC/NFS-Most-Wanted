/**
 * Yanal lastik modeli (Pacejka benzeri, sadeleştirilmiş). Rapier'ın raycast aracı yanal sürtünmeyi
 * "sonsuz sert" çözer: küçük direksiyonda bile lastik hemen azami yanal g'ye doyar ve kademesiz bir
 * direksiyon hissi vermez. Bu model, kayma açısına bağlı kademeli bir yanal kuvvet üretir:
 *   Fy = -Fz · mu · sin(C · atan(B · α))
 * Tepe kayma açısından sonra kuvvet yumuşakça düşer (drift/savrulma hissi).
 */
export const TIRE = {
  /** Sertlik: küçük kayma açılarında eğim (1/rad) */
  B: 14,
  /** Şekil: >1 tepe sonrası düşüş verir */
  C: 1.4,
  /** Kayma açısı hesabında boyuna hız alt sınırı (m/s): sıfır hızda tekillik olmasın */
  minSpeed: 2,
} as const;

/** Tepe yanal kuvvete karşılık gelen kayma açısı (rad): C·atan(B·α) = π/2 */
export const PEAK_SLIP_ANGLE = Math.tan(Math.PI / (2 * TIRE.C)) / TIRE.B;

/** Tekerlek düzleminde kayma açısı (rad): yanal hız / |boyuna hız|. Yanal hız sol + alınır. */
export function slipAngle(lateralSpeed: number, longitudinalSpeed: number): number {
  return Math.atan2(lateralSpeed, Math.max(Math.abs(longitudinalSpeed), TIRE.minSpeed));
}

/** Normalize yanal kuvvet katsayısı 0..~1 (işaretsiz): |Fy| / (Fz·mu). */
export function lateralCoefficient(alpha: number): number {
  return Math.sin(TIRE.C * Math.atan(TIRE.B * Math.abs(alpha)));
}

/**
 * Tekerleğe etki eden yanal kuvvet (N). İşaret: kayma açısı pozitifse (tekerlek sola kayıyor)
 * kuvvet negatif (sağa) olur; yani kaymaya karşı koyar.
 */
export function lateralForce(alpha: number, normalLoad: number, mu: number): number {
  return 0 - Math.sign(alpha) * normalLoad * mu * lateralCoefficient(alpha);
}

/**
 * Sürtünme çemberi: boyuna kuvvet (gaz/fren) tutuş sınırının bir kısmını kullanıyorsa yanal tutuş
 * kalanla sınırlıdır. usage = |Fx| / (mu·Fz). Dönüş 0.12..1 (tamamen sıfırlanmaz: kontrol kalır).
 */
export function combinedScale(usage: number): number {
  const u = Math.min(1, Math.max(0, usage));
  return Math.max(0.12, Math.sqrt(1 - u * u));
}
