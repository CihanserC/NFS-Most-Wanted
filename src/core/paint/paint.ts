import defaultPaintJson from '../../data/paints/default.json';
import { normalizeHex } from '../color/color';
import { PAINT_TYPES, type PaintConfig, type PaintType } from './types';

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

const NUMBER_FIELDS = ['flakeSize', 'flakeDensity', 'gloss'] as const;
const COLOR_FIELDS = ['color', 'secondaryColor', 'tertiaryColor', 'flakeColor'] as const;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Bilinmeyen girdiyi geçerli bir PaintConfig'e çevirir: eksik/geçersiz alanlar
 * `fallback`'ten gelir, sayılar 0..1'e sıkıştırılır, renkler normalize edilir.
 */
export function sanitizePaint(input: unknown, fallback: PaintConfig = DEFAULT_PAINT): PaintConfig {
  const src = isObj(input) ? input : {};
  const type = PAINT_TYPES.includes(src.type as PaintType)
    ? (src.type as PaintType)
    : fallback.type;
  const out: PaintConfig = { ...fallback, type };
  for (const k of COLOR_FIELDS) {
    const v = typeof src[k] === 'string' ? normalizeHex(src[k]) : null;
    if (v) out[k] = v;
  }
  for (const k of NUMBER_FIELDS) {
    const v = src[k];
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = clamp01(v);
  }
  return out;
}

/** Katı doğrulama: sanitize'ın düzelteceği her şeyi hata olarak raporlar. */
export function validatePaint(input: unknown): string[] {
  if (!isObj(input)) return ['boya: nesne olmalı'];
  const errors: string[] = [];
  if (!PAINT_TYPES.includes(input.type as PaintType))
    errors.push(`type: ${PAINT_TYPES.join(', ')} değerlerinden biri olmalı`);
  for (const k of COLOR_FIELDS)
    if (typeof input[k] !== 'string' || !normalizeHex(input[k]))
      errors.push(`${k}: hex renk olmalı`);
  for (const k of NUMBER_FIELDS) {
    const v = input[k];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1)
      errors.push(`${k}: 0..1 arası sayı olmalı`);
  }
  return errors;
}

const parsedDefault = validatePaint(defaultPaintJson);
if (parsedDefault.length > 0)
  throw new Error(`data/paints/default.json geçersiz: ${parsedDefault.join('; ')}`);
export const DEFAULT_PAINT: PaintConfig = defaultPaintJson as PaintConfig;

/** Manifestteki her boya bölgesi için geçerli bir boya döndürür. */
export function normalizePaintMap(input: unknown, zones: string[]): Record<string, PaintConfig> {
  const src = isObj(input) ? input : {};
  return Object.fromEntries(zones.map((z) => [z, sanitizePaint(src[z])]));
}

export const PAINT_EXPORT_FORMAT = 'muscle-garage/paint';
export const PAINT_EXPORT_VERSION = 1;

export function serializePaintMap(paint: Record<string, PaintConfig>): string {
  return JSON.stringify(
    { format: PAINT_EXPORT_FORMAT, version: PAINT_EXPORT_VERSION, zones: paint },
    null,
    2,
  );
}

export class PaintImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaintImportError';
  }
}

/**
 * Dışa aktarılmış boya JSON'unu okur. Tek bir PaintConfig de kabul edilir
 * (o zaman tüm bölgelere uygulanır).
 */
export function parsePaintExport(json: string, zones: string[]): Record<string, PaintConfig> {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new PaintImportError('Geçerli bir JSON değil');
  }
  if (isObj(data) && data.format === PAINT_EXPORT_FORMAT) {
    if (data.version !== PAINT_EXPORT_VERSION)
      throw new PaintImportError(`Desteklenmeyen boya dosyası sürümü: ${String(data.version)}`);
    if (!isObj(data.zones)) throw new PaintImportError('"zones" alanı eksik');
    const zonesObj = data.zones;
    const known = zones.filter((z) => z in zonesObj);
    if (known.length === 0) throw new PaintImportError('Dosyada bu araca ait boya bölgesi yok');
    return normalizePaintMap(zonesObj, zones);
  }
  if (validatePaint(data).length === 0) {
    const single = sanitizePaint(data);
    return Object.fromEntries(zones.map((z) => [z, single]));
  }
  throw new PaintImportError('Tanınmayan boya dosyası');
}
