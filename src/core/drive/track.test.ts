import { describe, expect, it } from 'vitest';
import { formatLapTime, initialLap, updateLap } from './lap';
import { buildTrack, loopDelta, queryTrack, spawnPose, surfaceAt } from './track';

const track = buildTrack();

describe('pist üretimi (§10.1)', () => {
  it('uzunluk 1.5 – 2 km civarında', () => {
    expect(track.length).toBeGreaterThan(1500);
    expect(track.length).toBeLessThan(2000);
  });

  it('örnekler eşit aralıklı ve birim teğetli', () => {
    const n = track.samples.length;
    const gap = track.length / n;
    for (let i = 0; i < n; i++) {
      const a = track.samples[i]!;
      const b = track.samples[(i + 1) % n]!;
      expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeLessThan(gap * 1.5);
      expect(Math.hypot(a.tx, a.tz)).toBeCloseTo(1, 5);
    }
  });

  it('pist kendi üzerine binmez (komşu olmayan bölümler arası boşluk)', () => {
    const n = track.samples.length;
    const minGap = track.widthM + 2 * track.config.barrierOffsetM * 0.5;
    const skip = Math.ceil((track.widthM * 6) / (track.length / n));
    for (let i = 0; i < n; i += 3)
      for (let j = i + skip; j < n; j += 3) {
        if (n - (j - i) < skip) continue;
        const a = track.samples[i]!;
        const b = track.samples[j]!;
        expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(minGap);
      }
  });

  it('en dar viraj sürülebilir (yarıçap ≥ 15 m), düzlükler ve virajlar var', () => {
    const radii = track.samples.map((s) => s.radius);
    expect(Math.min(...radii)).toBeGreaterThanOrEqual(15);
    // Uzun düzlük: ardışık yarıçapı çok büyük örneklerden en az 300 m
    const straight =
      track.samples.filter((s) => s.radius > 600).length * (track.length / track.samples.length);
    expect(straight).toBeGreaterThan(300);
    // Keskin viraj (hairpin) ve hızlı viraj
    expect(radii.some((r) => r < 40)).toBe(true);
    expect(radii.some((r) => r > 90 && r < 400)).toBe(true);
  });

  it('merkez çizgi asfalt, kenar kerb, dışı çim', () => {
    const half = track.widthM / 2;
    expect(surfaceAt(track, 0)).toBe('asphalt');
    expect(surfaceAt(track, half + 0.5)).toBe('kerb');
    expect(surfaceAt(track, -(half + track.config.kerbM + 1))).toBe('grass');
  });

  it('queryTrack merkezde sıfır offset verir; hint ile aynı sonuç', () => {
    const s = track.samples[100]!;
    const full = queryTrack(track, s.x, s.z);
    expect(full.index).toBe(100);
    expect(Math.abs(full.offset)).toBeLessThan(1e-6);
    const left = queryTrack(track, s.x + s.nx * 3, s.z + s.nz * 3, 95);
    expect(left.index).toBe(100);
    expect(left.offset).toBeCloseTo(3, 5);
  });

  it('doğuş konumu çizginin gerisinde ve pist yönüne bakar', () => {
    const spawn = spawnPose(track);
    const q = queryTrack(track, spawn.x, spawn.z);
    expect(loopDelta(track, track.samples[track.startIndex]!.s, q.s)).toBeLessThan(0);
    const start = track.samples[q.index]!;
    expect(Math.sin(spawn.heading)).toBeCloseTo(start.tx, 1);
    expect(Math.cos(spawn.heading)).toBeCloseTo(start.tz, 1);
  });
});

describe('tur zamanı', () => {
  const L = track.length;
  const startS = track.samples[track.startIndex]!.s;
  const at = (frac: number) => (startS + frac * L + L) % L;

  /** Bir turu `lapSeconds` sürede, belirtilen kesirlerde örnekleyerek sürer. */
  function drive(state = initialLap(), t0 = 0, lapSeconds = 90, from = -0.01, to = 1.01) {
    let s = state;
    const steps = 400;
    for (let i = 0; i <= steps; i++) {
      const f = from + ((to - from) * i) / steps;
      s = updateLap(s, track, at(f), t0 + (f - from) * lapSeconds);
    }
    return s;
  }

  it('çizgiyi ilk geçiş süreyi başlatır, tam tur süreyi kaydeder', () => {
    const first = drive(initialLap(), 0, 90, -0.01, 0.2);
    expect(first.running).toBe(true);
    expect(first.laps).toBe(0);
    const done = drive(first, 20, 90, 0.2, 1.02);
    expect(done.laps).toBe(1);
    expect(done.lastLap).not.toBeNull();
    expect(done.bestLap).toBe(done.lastLap);
  });

  it('kontrol noktaları atlanırsa tur sayılmaz', () => {
    let s = drive(initialLap(), 0, 90, -0.01, 0.2);
    // 0.2'den doğrudan 0.99'a ışınlan (kısayol)
    s = updateLap(s, track, at(0.99), 50);
    s = updateLap(s, track, at(1.01), 51);
    expect(s.laps).toBe(0);
    expect(s.running).toBe(true);
  });

  it('çizgiyi geri geçmek turu geçersiz yapar', () => {
    let s = drive(initialLap(), 0, 90, -0.01, 0.01);
    s = drive(s, 1, 90, 0.01, -0.02);
    expect(s.invalid).toBe(true);
  });

  it('en iyi tur daha hızlı turla güncellenir', () => {
    let s = drive(initialLap(), 0, 90, -0.01, 1.02);
    s = drive(s, 100, 80, 0.0, 1.02);
    expect(s.laps).toBeGreaterThanOrEqual(2);
    expect(s.bestLap!).toBeLessThanOrEqual(s.lastLap!);
  });

  it('zaman biçimi', () => {
    expect(formatLapTime(null)).toBe('--:--.---');
    expect(formatLapTime(83.456)).toBe('1:23.456');
    expect(formatLapTime(5.0049)).toBe('0:05.005');
  });
});
