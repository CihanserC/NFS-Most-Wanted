import type { Track, TrackSample } from './track';

export type BarrierSegment = {
  x: number;
  z: number;
  /** y ekseni etrafında dönüş (rad): +z yönünü (sin yaw, cos yaw)'a çevirir */
  yaw: number;
  /** Görsel yarı uzunluk (köşelerde aralık kalmasın diye örtüşme payıyla) */
  halfLength: number;
  /** Zincir noktaları arasındaki tam yarı uzunluk (fizik kapsülü: uçları komşuyla ortak) */
  halfSpan: number;
  /** 1 = pistin solu, -1 = sağı */
  side: 1 | -1;
};

/** Bariyerler her kaç pist örneğinde bir segment olur */
const SEGMENT_STEP = 6;
/** Segment uçlarının örtüşme payı (m): köşelerde aralık kalmasın */
const OVERLAP = 0.6;
/** Bariyerin pist kenarından (kerb dışı) en az bu kadar uzakta durması (m) */
const MIN_CLEARANCE = 2;
/** Ofset daraltma adımı (m) */
const SHRINK_STEP = 0.5;

/**
 * Pistin bir kenarında, örnek başına bariyer ofseti. Varsayılan `barrierOffsetM`; viraj içinde
 * veya pistin başka bir bölümüne yaklaşan yerlerde nokta diğer bölüme daha yakın olmayacak kadar
 * daraltılır (en az kerb + MIN_CLEARANCE). Ardından komşu örneklerle yumuşatılır (ani girinti olmasın).
 */
function sideOffsets(track: Track, side: 1 | -1): number[] {
  const n = track.samples.length;
  const half = track.widthM / 2;
  const full = half + track.config.barrierOffsetM;
  const min = half + track.config.kerbM + MIN_CLEARANCE;
  const raw = track.samples.map((s, i) => {
    for (let off = full; off > min; off -= SHRINK_STEP) {
      const x = s.x + s.nx * off * side;
      const z = s.z + s.nz * off * side;
      let nearest = Infinity;
      for (let k = 0; k < n; k += 2) {
        // Kendi çevresi hariç: komşu örnekler zaten off uzaklıkta
        const d = Math.abs(k - i);
        if (Math.min(d, n - d) < 4) continue;
        const o = track.samples[k] as TrackSample;
        nearest = Math.min(nearest, Math.hypot(o.x - x, o.z - z));
      }
      // Pistin başka bir bölümünün asfaltına/kerbine girmesin
      if (nearest >= min) return off;
    }
    return min;
  });
  // Ani daralmayı yay: her örnek, çevresindeki en küçük ofseti alır
  const window = SEGMENT_STEP * 2;
  return raw.map((_, i) => {
    let m = Infinity;
    for (let k = -window; k <= window; k++) m = Math.min(m, raw[(((i + k) % n) + n) % n] as number);
    return m;
  });
}

/**
 * Pist kenarlarındaki bariyerler: her kenarda uçları ortak, kesintisiz bir zincir. Uç noktalar
 * pist normali boyunca ofsetlenmiş örneklerden alındığı için virajın dış tarafında da aralık kalmaz.
 * Fizik çarpışma kutuları ve görsel aynı segmentleri kullanır.
 */
export function computeBarriers(track: Track): BarrierSegment[] {
  const n = track.samples.length;
  const offsets = { 1: sideOffsets(track, 1), [-1]: sideOffsets(track, -1) } as Record<
    1 | -1,
    number[]
  >;
  const point = (i: number, side: 1 | -1): [number, number] => {
    const k = ((i % n) + n) % n;
    const s = track.samples[k] as TrackSample;
    const off = offsets[side][k] as number;
    return [s.x + s.nx * off * side, s.z + s.nz * off * side];
  };
  const out: BarrierSegment[] = [];
  for (let i = 0; i < n; i += SEGMENT_STEP) {
    // Son segment döngüyü kapatır (n, STEP'in katı olmayabilir)
    const j = Math.min(i + SEGMENT_STEP, n);
    for (const side of [1, -1] as const) {
      const [ax, az] = point(i, side);
      const [bx, bz] = point(j, side);
      const dx = bx - ax;
      const dz = bz - az;
      out.push({
        x: (ax + bx) / 2,
        z: (az + bz) / 2,
        yaw: Math.atan2(dx, dz),
        halfLength: Math.hypot(dx, dz) / 2 + OVERLAP,
        halfSpan: Math.hypot(dx, dz) / 2,
        side,
      });
    }
  }
  return out;
}
