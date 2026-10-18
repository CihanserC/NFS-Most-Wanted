import circuitJson from '../../data/track/circuit.json';

export type Surface = 'asphalt' | 'kerb' | 'grass';

export type TrackSample = {
  x: number;
  z: number;
  /** Birim teğet (gidiş yönü) */
  tx: number;
  tz: number;
  /** Sol taraf birim normali (gidiş yönüne göre) */
  nx: number;
  nz: number;
  /** Başlangıçtan yay uzunluğu (m) */
  s: number;
  /** Bu noktadaki eğrilik yarıçapı (m); düzlükte çok büyük */
  radius: number;
};

export type TrackConfig = typeof circuitJson;

export type Track = {
  config: TrackConfig;
  samples: TrackSample[];
  length: number;
  widthM: number;
  /** Başlangıç çizgisinin örnek indeksi */
  startIndex: number;
};

type P = readonly [number, number];

/** Kapalı Catmull-Rom spline noktası (t: 0..1, p1->p2 arası). */
function catmull(p0: P, p1: P, p2: P, p3: P, t: number): [number, number] {
  const t2 = t * t;
  const t3 = t2 * t;
  const f = (a: number, b: number, c: number, d: number) =>
    0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  return [f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])];
}

/** Kontrol noktalarından yoğun örneklenmiş kapalı eğri (düzensiz aralıklı). */
function denseLoop(points: readonly P[], perSegment = 64): [number, number][] {
  const n = points.length;
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [
      points[(i - 1 + n) % n],
      points[i],
      points[(i + 1) % n],
      points[(i + 2) % n],
    ] as [P, P, P, P];
    for (let k = 0; k < perSegment; k++) out.push(catmull(p0, p1, p2, p3, k / perSegment));
  }
  return out;
}

/** Eğriyi eşit yay uzunluğu aralıklarıyla yeniden örnekler. */
function resample(
  loop: [number, number][],
  spacing: number,
): { pts: [number, number][]; length: number } {
  const n = loop.length;
  const cum: number[] = [0];
  for (let i = 1; i <= n; i++) {
    const a = loop[i - 1] as [number, number];
    const b = loop[i % n] as [number, number];
    cum.push((cum[i - 1] as number) + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const total = cum[n] as number;
  const count = Math.max(8, Math.round(total / spacing));
  const pts: [number, number][] = [];
  let seg = 0;
  for (let k = 0; k < count; k++) {
    const target = (k / count) * total;
    while ((cum[seg + 1] as number) < target) seg++;
    const a = loop[seg] as [number, number];
    const b = loop[(seg + 1) % n] as [number, number];
    const span = (cum[seg + 1] as number) - (cum[seg] as number);
    const u = span === 0 ? 0 : (target - (cum[seg] as number)) / span;
    pts.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]);
  }
  return { pts, length: total };
}

export function buildTrack(config: TrackConfig = circuitJson): Track {
  const { pts, length } = resample(
    denseLoop(
      (config.points as unknown as P[]).map(
        ([x, z]) => [x * config.scale, z * config.scale] as const,
      ),
    ),
    config.sampleSpacingM,
  );
  const n = pts.length;
  const spacing = length / n;
  const samples: TrackSample[] = pts.map(([x, z], i) => {
    const prev = pts[(i - 1 + n) % n] as [number, number];
    const next = pts[(i + 1) % n] as [number, number];
    const dx = next[0] - prev[0];
    const dz = next[1] - prev[1];
    const len = Math.hypot(dx, dz) || 1;
    const tx = dx / len;
    const tz = dz / len;
    // Eğrilik: komşu teğetler arasındaki açı değişimi / yay uzunluğu
    const before = Math.atan2(z - prev[1], x - prev[0]);
    const after = Math.atan2(next[1] - z, next[0] - x);
    let dTheta = after - before;
    while (dTheta > Math.PI) dTheta -= 2 * Math.PI;
    while (dTheta < -Math.PI) dTheta += 2 * Math.PI;
    const radius = Math.abs(dTheta) < 1e-6 ? 1e6 : spacing / Math.abs(dTheta);
    return { x, z, tx, tz, nx: -tz, nz: tx, s: i * spacing, radius };
  });
  return {
    config,
    samples,
    length,
    widthM: config.widthM,
    startIndex: Math.floor(config.startIndexFraction * n) % n,
  };
}

export type TrackQuery = {
  index: number;
  /** Yay uzunluğu (m), 0..length */
  s: number;
  /** Merkez çizgiden işaretli yanal uzaklık (sol pozitif) */
  offset: number;
  surface: Surface;
};

export function surfaceAt(track: Track, offset: number): Surface {
  const half = track.widthM / 2;
  const d = Math.abs(offset);
  if (d <= half) return 'asphalt';
  if (d <= half + track.config.kerbM) return 'kerb';
  return 'grass';
}

/**
 * Konuma en yakın pist örneği. hint verilirse onun etrafında aranır (kare başına ucuz);
 * hint yoksa tüm pist taranır.
 */
export function queryTrack(
  track: Track,
  x: number,
  z: number,
  hint?: number,
  window = 40,
): TrackQuery {
  const n = track.samples.length;
  let best = 0;
  let bestD = Infinity;
  const consider = (i: number) => {
    const s = track.samples[i] as TrackSample;
    const d = (s.x - x) ** 2 + (s.z - z) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  };
  if (hint === undefined) for (let i = 0; i < n; i++) consider(i);
  else for (let k = -window; k <= window; k++) consider((((hint + k) % n) + n) % n);
  const s = track.samples[best] as TrackSample;
  const offset = (x - s.x) * s.nx + (z - s.z) * s.nz;
  return { index: best, s: s.s, offset, surface: surfaceAt(track, offset) };
}

/** Başlangıç çizgisinin gerisinde, pist yönüne bakan doğuş konumu. */
export function spawnPose(track: Track): { x: number; z: number; heading: number } {
  const n = track.samples.length;
  const back = Math.round(track.config.spawnBackM / (track.length / n));
  const s = track.samples[(((track.startIndex - back) % n) + n) % n] as TrackSample;
  return { x: s.x, z: s.z, heading: Math.atan2(s.tx, s.tz) };
}

/** İki yay uzunluğu arasındaki işaretli en kısa fark (kapalı döngüde). */
export function loopDelta(track: Track, from: number, to: number): number {
  let d = to - from;
  if (d > track.length / 2) d -= track.length;
  if (d < -track.length / 2) d += track.length;
  return d;
}

let cached: Track | null = null;

/** Varsayılan pist (bir kez üretilir; sahne, HUD ve fizik aynı örneği paylaşır). */
export function getDefaultTrack(): Track {
  cached ??= buildTrack();
  return cached;
}
