import { t } from '../../i18n';
import { newLayerId, sanitizeLayers } from './layers';
import { vinylConfig } from './projection';
import type { VinylLayer } from './types';

/** Vinil grubu dışa/içe aktarma biçimi (başka tasarıma taşımak için). */
export const VINYL_EXPORT_FORMAT = 'muscle-garage/vinyl';
export const VINYL_EXPORT_VERSION = 1;

export class VinylImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VinylImportError';
  }
}

export function serializeVinylGroup(layers: VinylLayer[], name = ''): string {
  return JSON.stringify(
    { format: VINYL_EXPORT_FORMAT, version: VINYL_EXPORT_VERSION, name, layers },
    null,
    2,
  );
}

/**
 * Dışa aktarılmış vinil JSON'unu okur. Katmanlar yeni kimlik alır (mevcut tasarımla
 * çakışmasın); gruplar yeniden eşlenir. Birden fazla katman tek grup olarak gelir ki
 * içe aktarıldıktan sonra birlikte taşınabilsin.
 */
export function parseVinylGroup(json: string, isShape: (id: string) => boolean): VinylLayer[] {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new VinylImportError(t('error.invalidJson'));
  }
  const obj = data as { format?: unknown; version?: unknown; layers?: unknown };
  if (!obj || typeof obj !== 'object' || obj.format !== VINYL_EXPORT_FORMAT)
    throw new VinylImportError(t('vinyl.error.unknown'));
  if (obj.version !== VINYL_EXPORT_VERSION)
    throw new VinylImportError(t('vinyl.error.version', { v: String(obj.version) }));
  const layers = sanitizeLayers(obj.layers, isShape);
  if (layers.length === 0) throw new VinylImportError(t('vinyl.error.empty'));

  const groupMap = new Map<string, string>();
  const single = layers.length > 1 ? newLayerId().replace(/^v/, 'g') : undefined;
  return layers.map((l) => {
    const out: VinylLayer = { ...l, id: newLayerId() };
    if (l.groupId) {
      if (!groupMap.has(l.groupId)) groupMap.set(l.groupId, newLayerId().replace(/^v/, 'g'));
      out.groupId = groupMap.get(l.groupId);
    }
    // Tek grup olarak gelsin: alt gruplar varsa korunmaz, hepsi aynı gruba alınır.
    if (single) out.groupId = single;
    return out;
  });
}

/** Mevcut katmanlara eklenince limit aşılıyor mu */
export const exceedsLimit = (current: number, adding: number) =>
  current + adding > vinylConfig.layerLimit;
