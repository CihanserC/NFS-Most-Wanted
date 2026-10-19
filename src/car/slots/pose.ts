import type { CarDefinition } from '../../data/cars';
import { sample1, sample2 } from '../surface';

/**
 * Parça yerleşimi için gövde ölçüleri. Araçta gerçek modelden ölçülmüş yüzey (`car.surface`) varsa
 * o kullanılır; yoksa prosedürel profil (`car.body`). Böylece aynı parça hem placeholder gövdeye
 * hem gerçek modele oturur.
 */

/** Üst yüzeyin (kaput, tavan, bagaj) (x, z)'deki yüksekliği. */
export function topY(car: CarDefinition, z: number, x = 0): number {
  const s = car.surface ? sample2(car.surface.top, z, Math.abs(x)) : null;
  return s ?? car.body.deckY(z);
}

/** Gövde yan yüzeyinin (z, y)'deki dış x'i. */
export function sideX(car: CarDefinition, z: number, y: number): number {
  const s = car.surface ? sample2(car.surface.side, z, y) : null;
  return s ?? car.body.sideX(z, y);
}

/** x=0'da gövdenin en öndeki z'si (y yüksekliğinde). */
export function noseZ(car: CarDefinition, y: number): number {
  const s = car.surface ? sample1(car.surface.nose, y) : null;
  return s ?? car.body.halfLength;
}

/** x=0'da gövdenin en arkadaki z'si (y yüksekliğinde). */
export function tailZ(car: CarDefinition, y: number): number {
  const s = car.surface ? sample1(car.surface.tail, y) : null;
  return s ?? -car.body.halfLength;
}

/** x=0'da alt yüzey yüksekliği. */
export function bottomY(car: CarDefinition, z: number): number {
  const s = car.surface ? sample1(car.surface.bottom, z) : null;
  return s ?? car.body.bottomY(z);
}

/** Üst yüzeyin z'deki yüksekliği ve boyuna eğimi (parçayı yüzeye oturtmak için). */
export function deckPose(car: CarDefinition, z: number, x = 0): { y: number; angle: number } {
  const h = 0.02;
  const slope = (topY(car, z + h, x) - topY(car, z - h, x)) / (2 * h);
  return { y: topY(car, z, x), angle: -Math.atan(slope) };
}

/**
 * Dikdörtgen bir ayak izinin (merkez x/z, yarı genişlik/derinlik) altındaki en alçak yüzey
 * yüksekliği. Parça buna oturtulursa kavisli kaputta kenarlar havada kalmaz (orta kısım gövdeye
 * gömülür, görünmez).
 */
export function restY(
  car: CarDefinition,
  z: number,
  halfDepth: number,
  x: number,
  halfWidth: number,
): number {
  let min = Infinity;
  for (const dz of [-halfDepth, 0, halfDepth])
    for (const dx of [-halfWidth, 0, halfWidth]) min = Math.min(min, topY(car, z + dz, x + dx));
  return min;
}

/**
 * z'de üst yüzeyin (kaput/bagaj) kullanılabilir yarı genişliği: orta çizgiden en fazla `drop`
 * kadar alçalan en dış x. Yüzey haritası yoksa profil genişliğinin %85'i.
 */
export function deckHalfWidth(car: CarDefinition, z: number, drop = 0.1): number {
  const surface = car.surface;
  if (!surface) return car.body.halfWidth(z) * 0.85;
  const center = topY(car, z);
  let x = 0;
  for (let k = 0.05; k < 1.2; k += 0.05) {
    // Gövde dışı (ışın çarpmadı) ya da kenara doğru fazla alçalma: kullanılabilir yüzey biter
    const y = sample2(surface.top, z, k);
    if (y === null || y < center - drop) break;
    x = k;
  }
  return x;
}

/**
 * Kaputun arka kenarı (ön camın bittiği yer). Yüzey haritasında burundan geriye doğru taranır:
 * orta çizgi yüksekliği ön cam eğimiyle (≥ %40) yükselmeye başladığı ilk nokta. Harita yoksa profil.
 */
export function hoodRearZ(car: CarDefinition): number {
  if (!car.surface) return car.body.profile.hood.zStart;
  const step = 0.05;
  for (let z = noseZ(car, 0.5) - 0.4; z > 0; z -= step)
    if (topY(car, z - step) - topY(car, z) > 0.4 * step) return z;
  return car.body.profile.hood.zStart;
}

export function roofPose(car: CarDefinition, z: number): { y: number; angle: number } {
  const h = 0.01;
  const slope = (car.body.roofY(z + h) - car.body.roofY(z - h)) / (2 * h);
  return { y: car.body.roofY(z), angle: -Math.atan(slope) };
}
