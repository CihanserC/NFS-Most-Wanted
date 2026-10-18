import type { Track, TrackSample } from './track';

export type BarrierSegment = {
  x: number;
  z: number;
  /** y ekseni etrafında dönüş (rad): +z yönünü (sin yaw, cos yaw)'a çevirir */
  yaw: number;
  halfLength: number;
};

/** Bariyerler her kaç pist örneğinde bir segment olur */
const SEGMENT_STEP = 6;
/** Segment uçlarının örtüşme payı (m) */
const OVERLAP = 0.3;

/**
 * Pist kenarlarındaki bariyer segmentleri. Fizik çarpışma kutuları ve görsel ortak kullanır.
 * Bariyer noktası başka bir pist bölümüne daha yakınsa (viraj içi, bitişik pist) konmaz.
 */
export function computeBarriers(track: Track): BarrierSegment[] {
  const n = track.samples.length;
  const dist = track.widthM / 2 + track.config.barrierOffsetM;
  const out: BarrierSegment[] = [];
  for (let i = 0; i < n; i += SEGMENT_STEP) {
    const a = track.samples[i] as TrackSample;
    const b = track.samples[(i + SEGMENT_STEP) % n] as TrackSample;
    for (const side of [1, -1]) {
      const x = (a.x + b.x) / 2 + ((a.nx + b.nx) / 2) * dist * side;
      const z = (a.z + b.z) / 2 + ((a.nz + b.nz) / 2) * dist * side;
      let nearest = Infinity;
      for (let k = 0; k < n; k += 2) {
        const s = track.samples[k] as TrackSample;
        nearest = Math.min(nearest, Math.hypot(s.x - x, s.z - z));
      }
      if (nearest < dist - 1.5) continue;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      out.push({ x, z, yaw: Math.atan2(dx, dz), halfLength: Math.hypot(dx, dz) / 2 + OVERLAP });
    }
  }
  return out;
}
