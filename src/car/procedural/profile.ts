import { monotoneCurve, type Curve, type CurvePoint } from '../../core/math/curve';
import type { CarManifest } from '../../core/manifest/types';

/** Placeholder gövdenin profil eğrileri (data/cars/<id>/placeholder.json). */
export type PlaceholderProfile = {
  stations: number;
  sideSamples: number;
  shoulderSamples: number;
  shoulderDrop: number;
  shoulderExponent: number;
  wellInnerX: number;
  /** z -> kaput/bagaj orta çizgi yüksekliği */
  deckLine: CurvePoint[];
  /** z -> gövde alt kenarı */
  bottomLine: CurvePoint[];
  /** z -> en geniş yarı genişlik */
  halfWidth: CurvePoint[];
  /** y -> yarı genişlik çarpanı (yan yüzey kesiti) */
  sideShape: CurvePoint[];
  cabin: {
    stations: number;
    ringSamples: number;
    exponent: number;
    baseY: number;
    zStart: number;
    zEnd: number;
    roofLine: CurvePoint[];
    baseHalfWidth: CurvePoint[];
    topHalfWidthRatio: number;
    windshield: [number, number];
    rearGlass: [number, number];
    sideGlass: [number, number];
    /** Bu açının (rad) üstündeki kabin yüzleri "üst" sayılır. */
    topAngle: number;
    /** Üst (cam/tavan) ile yan cam arasındaki boyalı direk bandının açısal genişliği (rad). */
    pillarAngle: number;
    /** Yan camın alt sınırı (kemer çizgisi), rad. */
    beltAngle: number;
  };
  hood: { zStart: number; zEnd: number };
  blowerCutout: { zCenter: number; halfLength: number; halfWidth: number };
  /** Kabin altında üst yüzeyi açık bırakılan bölge (iç mekan görünsün diye). */
  cabinOpening: { zStart: number; zEnd: number; halfWidth: number; floorY: number };
};

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isPoints = (v: unknown): v is CurvePoint[] =>
  Array.isArray(v) &&
  v.length > 0 &&
  v.every((p) => Array.isArray(p) && p.length === 2 && isNum(p[0]) && isNum(p[1]));
const isRange = (v: unknown): v is [number, number] =>
  Array.isArray(v) && v.length === 2 && isNum(v[0]) && isNum(v[1]) && v[0] < v[1];

export function parsePlaceholderProfile(input: unknown, source: string): PlaceholderProfile {
  const errors: string[] = [];
  const p = input as Record<string, unknown>;
  const cabin = (p?.cabin ?? {}) as Record<string, unknown>;
  const num = (o: Record<string, unknown>, k: string, path: string) => {
    if (!isNum(o[k])) errors.push(`${path}${k}: sayı olmalı`);
  };
  for (const k of [
    'stations',
    'sideSamples',
    'shoulderSamples',
    'shoulderDrop',
    'shoulderExponent',
    'wellInnerX',
  ])
    num(p, k, '');
  for (const k of ['deckLine', 'bottomLine', 'halfWidth', 'sideShape'])
    if (!isPoints(p[k])) errors.push(`${k}: [[x, y], ...] olmalı`);
  for (const k of [
    'stations',
    'ringSamples',
    'exponent',
    'baseY',
    'zStart',
    'zEnd',
    'topHalfWidthRatio',
    'topAngle',
    'pillarAngle',
    'beltAngle',
  ])
    num(cabin, k, 'cabin.');
  for (const k of ['roofLine', 'baseHalfWidth'])
    if (!isPoints(cabin[k])) errors.push(`cabin.${k}: [[x, y], ...] olmalı`);
  for (const k of ['windshield', 'rearGlass', 'sideGlass'])
    if (!isRange(cabin[k])) errors.push(`cabin.${k}: [başlangıç, bitiş] olmalı`);
  const hood = p?.hood as Record<string, unknown> | undefined;
  if (!hood || !isNum(hood.zStart) || !isNum(hood.zEnd))
    errors.push('hood: { zStart, zEnd } olmalı');
  const cut = p?.blowerCutout as Record<string, unknown> | undefined;
  if (!cut || !isNum(cut.zCenter) || !isNum(cut.halfLength) || !isNum(cut.halfWidth))
    errors.push('blowerCutout: { zCenter, halfLength, halfWidth } olmalı');
  const open = p?.cabinOpening as Record<string, unknown> | undefined;
  if (!open || ![open.zStart, open.zEnd, open.halfWidth, open.floorY].every(isNum))
    errors.push('cabinOpening: { zStart, zEnd, halfWidth, floorY } olmalı');

  if (errors.length > 0)
    throw new Error(`Geçersiz placeholder profili (${source}):\n  - ${errors.join('\n  - ')}`);
  return input as PlaceholderProfile;
}

/** Profil + manifestten türetilen, parçaların konumlandırılmasında kullanılan örnekleyici. */
export type BodySampler = {
  halfLength: number;
  deckY: Curve;
  bottomY: Curve;
  halfWidth: Curve;
  /** Belirli z ve y'de gövde yan yüzeyinin x konumu. */
  sideX: (z: number, y: number) => number;
  /** Tekerlek kemeri üst yüksekliği (kemer dışında bottomY). */
  archTopY: Curve;
  roofY: Curve;
  cabinHalfWidth: (z: number, heightFraction: number) => number;
  wheelArches: { z: number; centerY: number; radius: number }[];
  profile: PlaceholderProfile;
};

const MM = 0.001;

export function createBodySampler(manifest: CarManifest, profile: PlaceholderProfile): BodySampler {
  const deckY = monotoneCurve(profile.deckLine);
  const bottomY = monotoneCurve(profile.bottomLine);
  const halfWidth = monotoneCurve(profile.halfWidth);
  const sideShape = monotoneCurve(profile.sideShape);
  const roofCurve = monotoneCurve(profile.cabin.roofLine);
  const cabinBase = monotoneCurve(profile.cabin.baseHalfWidth);
  const { wheels } = manifest;

  const wheelArches = [
    {
      z: wheels.FL.position[2],
      centerY: wheels.FL.position[1],
      clearance: wheels.wellClearanceMm.front,
    },
    {
      z: wheels.RL.position[2],
      centerY: wheels.RL.position[1],
      clearance: wheels.wellClearanceMm.rear,
    },
  ].map((w) => ({ z: w.z, centerY: w.centerY, radius: w.centerY + w.clearance * MM }));

  const archTopY: Curve = (z) => {
    let y = bottomY(z);
    for (const a of wheelArches) {
      const dz = z - a.z;
      if (Math.abs(dz) < a.radius) y = Math.max(y, a.centerY + Math.sqrt(a.radius ** 2 - dz ** 2));
    }
    return y;
  };

  const { zStart, zEnd, baseY, topHalfWidthRatio } = profile.cabin;
  const roofY: Curve = (z) => (z < zStart || z > zEnd ? baseY : roofCurve(z));

  return {
    halfLength: manifest.dimensions.length / 2,
    deckY,
    bottomY,
    halfWidth,
    sideX: (z, y) => halfWidth(z) * sideShape(y),
    archTopY,
    roofY,
    cabinHalfWidth: (z, s) => cabinBase(z) * (1 - (1 - topHalfWidthRatio) * s),
    wheelArches,
    profile,
  };
}
