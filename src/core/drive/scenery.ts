import type { Track, TrackSample } from './track';

export type SceneryItem = { x: number; z: number; scale: number; rotation: number };
export type LampPost = { x: number; z: number; yaw: number };
export type Grandstand = { x: number; z: number; yaw: number; length: number };
/** Başlangıç/bitiş kapısı: pisti dik kesen köprü; yaw pist yönü, span direkler arası (m) */
export type StartGantry = { x: number; z: number; yaw: number; span: number };

/** Kapı direğinin kare kesit kenarı (m); fizik çarpışma kutusu da bunu kullanır */
export const GANTRY_PILLAR_M = 0.8;

export type Scenery = {
  /** Kozalaklı (koni taç) */
  pines: SceneryItem[];
  /** Yapraklı (yuvarlak taç) */
  oaks: SceneryItem[];
  rocks: SceneryItem[];
  lamps: LampPost[];
  grandstands: Grandstand[];
  gantry: StartGantry;
};

/** Tekrarlanabilir rastgelelik (mulberry32) */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PINE_COUNT = 220;
const OAK_COUNT = 160;
const ROCK_COUNT = 90;
/** Ağaçların bir kısmı gruplar halinde (koru) yerleşir; geri kalanı serbest */
const GROVE_COUNT = 14;
const GROVE_RADIUS = 34;
const LAMP_EVERY_SAMPLES = 70;
/** Pist merkezinden bu mesafenin içine ağaç/kaya konmaz (bariyer dışı + pay) */
const CLEARANCE_MARGIN = 6;
const FIELD_RADIUS = 520;

/** Pistin etrafında ağaç, kaya, direk ve tribün yerleşimi (saf, sabit tohumlu). */
export function buildScenery(track: Track, seed = 7): Scenery {
  const random = rng(seed);
  const minDist = track.widthM / 2 + track.config.barrierOffsetM + CLEARANCE_MARGIN;
  const xs = track.samples.map((s) => s.x);
  const zs = track.samples.map((s) => s.z);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cz = (Math.min(...zs) + Math.max(...zs)) / 2;

  const groves = Array.from({ length: GROVE_COUNT }, () => ({
    x: cx + (random() * 2 - 1) * FIELD_RADIUS * 0.85,
    z: cz + (random() * 2 - 1) * FIELD_RADIUS * 0.85,
  }));

  const place = (count: number, scaleRange: [number, number], groveShare = 0): SceneryItem[] => {
    const items: SceneryItem[] = [];
    let attempts = 0;
    while (items.length < count && attempts < count * 40) {
      attempts++;
      let x: number;
      let z: number;
      const grove =
        random() < groveShare ? groves[Math.floor(random() * groves.length)] : undefined;
      if (grove) {
        const a = random() * Math.PI * 2;
        const r = Math.sqrt(random()) * GROVE_RADIUS;
        x = grove.x + Math.cos(a) * r;
        z = grove.z + Math.sin(a) * r;
      } else {
        x = cx + (random() * 2 - 1) * FIELD_RADIUS;
        z = cz + (random() * 2 - 1) * FIELD_RADIUS;
      }
      if (distanceToTrack(track, x, z) < minDist) continue;
      items.push({
        x,
        z,
        scale: scaleRange[0] + random() * (scaleRange[1] - scaleRange[0]),
        rotation: random() * Math.PI * 2,
      });
    }
    return items;
  };

  const lamps: LampPost[] = [];
  const lampOffset = track.widthM / 2 + track.config.barrierOffsetM + 2.5;
  for (let i = 0; i < track.samples.length; i += LAMP_EVERY_SAMPLES) {
    const s = track.samples[i] as TrackSample;
    // Yalnızca düz kısımlara: viraj içinde bariyerle çakışmasın
    if (s.radius < 120) continue;
    const side = (i / LAMP_EVERY_SAMPLES) % 2 === 0 ? 1 : -1;
    lamps.push({
      x: s.x + s.nx * lampOffset * side,
      z: s.z + s.nz * lampOffset * side,
      yaw: Math.atan2(-s.nx * side, -s.nz * side),
    });
  }

  // Tribün: başlangıç çizgisinin iki yanında, bariyerin gerisinde
  const start = track.samples[track.startIndex] as TrackSample;
  const standOffset = track.widthM / 2 + track.config.barrierOffsetM + 9;
  const grandstands: Grandstand[] = [1, -1].map((side) => ({
    x: start.x + start.tx * 40 + start.nx * standOffset * side,
    z: start.z + start.tz * 40 + start.nz * standOffset * side,
    yaw: Math.atan2(-start.nx * side, -start.nz * side),
    length: 46,
  }));

  return {
    pines: place(PINE_COUNT, [0.8, 1.6], 0.55),
    oaks: place(OAK_COUNT, [0.7, 1.4], 0.65),
    rocks: place(ROCK_COUNT, [0.6, 2.4]),
    lamps,
    grandstands,
    gantry: startGantry(track),
  };
}

/**
 * Başlangıç/bitiş kapısı: çizginin tam üstünde; direkler bariyerlerin hemen dışında durur ki
 * araç direğe ancak bariyeri aşarak ulaşabilsin (direkler ayrıca fizikte katıdır).
 */
export function startGantry(track: Track): StartGantry {
  const start = track.samples[track.startIndex] as TrackSample;
  return {
    x: start.x,
    z: start.z,
    yaw: Math.atan2(start.tx, start.tz),
    span: track.widthM + 2 * (track.config.barrierOffsetM + 1.2),
  };
}

/** Konumun pist merkez çizgisine en kısa mesafesi (tüm pist taranır). */
export function distanceToTrack(track: Track, x: number, z: number): number {
  let best = Infinity;
  for (const s of track.samples) best = Math.min(best, Math.hypot(s.x - x, s.z - z));
  return best;
}
