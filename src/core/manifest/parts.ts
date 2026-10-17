import type { CarManifest } from './types';

export type PartDefinition = {
  /** Ekonomi ilk sürümde yok; alan ileride kullanılmak üzere tutuluyor. */
  price: number;
  weightKg: number;
  downforce?: number;
  trackWidthLimitMm?: number;
};

export type PartsCatalog = Record<string, Record<string, PartDefinition>>;

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const OPTIONAL_NUMBERS = ['downforce', 'trackWidthLimitMm'] as const;

/** Parça kataloğunu doğrular ve manifestteki her slot seçeneğinin tanımlı olduğunu kontrol eder. */
export function validatePartsCatalog(input: unknown, manifest: CarManifest): string[] {
  const errors: string[] = [];
  if (!isObj(input)) return ['parts: nesne olmalı'];

  for (const [slotId, slot] of Object.entries(manifest.slots)) {
    const entries = input[slotId];
    if (!isObj(entries)) {
      errors.push(`parts.${slotId}: eksik`);
      continue;
    }
    for (const option of slot.options) {
      const p = entries[option];
      const path = `parts.${slotId}.${option}`;
      if (!isObj(p)) {
        errors.push(`${path}: eksik`);
        continue;
      }
      if (!isNum(p.price) || p.price < 0) errors.push(`${path}.price: negatif olmayan sayı olmalı`);
      if (!isNum(p.weightKg)) errors.push(`${path}.weightKg: sayı olmalı`);
      for (const k of OPTIONAL_NUMBERS)
        if (p[k] !== undefined && !isNum(p[k])) errors.push(`${path}.${k}: sayı olmalı`);
    }
    for (const option of Object.keys(entries))
      if (!slot.options.includes(option)) errors.push(`parts.${slotId}.${option}: manifestte yok`);
  }
  for (const slotId of Object.keys(input))
    if (!(slotId in manifest.slots)) errors.push(`parts.${slotId}: manifestte böyle bir slot yok`);
  return errors;
}

export function loadPartsCatalog(input: unknown, manifest: CarManifest): PartsCatalog {
  const errors = validatePartsCatalog(input, manifest);
  if (errors.length > 0)
    throw new Error(`Geçersiz parça kataloğu (${manifest.id}):\n  - ${errors.join('\n  - ')}`);
  return input as PartsCatalog;
}
