import type { Vec3 } from '../math/tuples';
import {
  DRIVETRAINS,
  WHEEL_IDS,
  type CameraPreset,
  type CarManifest,
  type SlotDefinition,
} from './types';

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

/** Aks mesafesi ile tekerlek z konumları arasındaki izin verilen fark (m). */
const WHEELBASE_TOLERANCE = 0.01;

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const isVec3 = (v: unknown): v is Vec3 => Array.isArray(v) && v.length === 3 && v.every(isNum);

/**
 * Elle yazılmış manifest doğrulayıcı. Tüm hataları toplar; ilk hatada durmaz.
 * Hata mesajları `yol: açıklama` biçimindedir.
 */
export function validateManifest(input: unknown): ValidationResult<CarManifest> {
  const errors: string[] = [];
  const err = (path: string, msg: string) => errors.push(`${path}: ${msg}`);

  if (!isObj(input)) return { ok: false, errors: ['manifest: nesne olmalı'] };
  const m = input;

  if (!isStr(m.id)) err('id', 'boş olmayan metin olmalı');
  else if (!/^[a-z0-9_]+$/.test(m.id)) err('id', 'sadece küçük harf, rakam ve _ içermeli');
  if (!isStr(m.displayName)) err('displayName', 'boş olmayan metin olmalı');
  if (m.units !== 'meters') err('units', '"meters" olmalı');
  if (m.forwardAxis !== '+Z') err('forwardAxis', '"+Z" olmalı');
  if (!isNum(m.massKg) || m.massKg <= 0) err('massKg', 'pozitif sayı olmalı');
  if (!DRIVETRAINS.includes(m.drivetrain as never))
    err('drivetrain', `${DRIVETRAINS.join(', ')} değerlerinden biri olmalı`);
  if (m.model !== null && !isStr(m.model)) err('model', 'null veya dosya yolu olmalı');

  // Boyutlar
  const dims = m.dimensions;
  if (!isObj(dims)) err('dimensions', 'nesne olmalı');
  else
    for (const k of ['length', 'width', 'height', 'wheelbase'] as const)
      if (!isNum(dims[k]) || dims[k] <= 0) err(`dimensions.${k}`, 'pozitif sayı olmalı');

  // Tekerlekler
  const wheels = m.wheels;
  if (!isObj(wheels)) err('wheels', 'nesne olmalı');
  else {
    for (const id of WHEEL_IDS) {
      const w = wheels[id];
      if (!isObj(w) || !isVec3(w.position))
        err(`wheels.${id}.position`, '[x, y, z] sayı dizisi olmalı');
    }
    const wc = wheels.wellClearanceMm;
    if (!isObj(wc) || !isNum(wc.front) || !isNum(wc.rear) || wc.front < 0 || wc.rear < 0)
      err('wheels.wellClearanceMm', '{ front, rear } negatif olmayan sayılar olmalı');
  }

  // Geometrik tutarlılık
  if (errors.length === 0 && isObj(dims) && isObj(wheels)) {
    const pos = (id: string) => (wheels[id] as { position: Vec3 }).position;
    const frontZ = (pos('FL')[2] + pos('FR')[2]) / 2;
    const rearZ = (pos('RL')[2] + pos('RR')[2]) / 2;
    const wb = dims.wheelbase as number;
    if (frontZ <= rearZ)
      err('wheels', 'ön tekerlekler arka tekerleklerden +Z yönünde ileride olmalı');
    if (Math.abs(frontZ - rearZ - wb) > WHEELBASE_TOLERANCE)
      err(
        'dimensions.wheelbase',
        `tekerlek konumlarıyla uyuşmuyor (hesaplanan ${(frontZ - rearZ).toFixed(3)} m)`,
      );
    for (const id of WHEEL_IDS) {
      const [x, y, z] = pos(id);
      if (
        Math.abs(x) > (dims.width as number) / 2 ||
        Math.abs(z) > (dims.length as number) / 2 ||
        y <= 0
      )
        err(`wheels.${id}.position`, 'araç boyutlarının dışında');
    }
  }

  // Boya bölgeleri
  if (!Array.isArray(m.paintZones) || m.paintZones.length === 0 || !m.paintZones.every(isStr))
    err('paintZones', 'boş olmayan metin dizisi olmalı');
  else if (new Set(m.paintZones).size !== m.paintZones.length)
    err('paintZones', 'tekrar eden bölge var');

  // Kamera presetleri
  const cams = m.cameraPresets;
  const camIds = new Set<string>();
  if (!isObj(cams)) err('cameraPresets', 'nesne olmalı');
  else
    for (const [id, c] of Object.entries(cams)) {
      camIds.add(id);
      if (!isObj(c) || !isVec3(c.position) || !isVec3(c.target))
        err(`cameraPresets.${id}`, '{ position: [x,y,z], target: [x,y,z] } olmalı');
    }
  if (!isStr(m.defaultCamera) || !camIds.has(m.defaultCamera))
    err('defaultCamera', 'cameraPresets içindeki bir anahtar olmalı');

  // Boya bölgesi kameraları (opsiyonel)
  if (m.paintZoneCameras !== undefined) {
    const pzc = m.paintZoneCameras;
    const zones = Array.isArray(m.paintZones) ? (m.paintZones as unknown[]) : [];
    if (!isObj(pzc)) err('paintZoneCameras', 'nesne olmalı');
    else
      for (const [zone, cam] of Object.entries(pzc)) {
        if (!zones.includes(zone)) err(`paintZoneCameras.${zone}`, 'paintZones içinde yok');
        if (!isStr(cam) || !camIds.has(cam))
          err(`paintZoneCameras.${zone}`, `"${String(cam)}" cameraPresets içinde tanımlı değil`);
      }
  }

  // Slotlar
  const slots = m.slots;
  if (!isObj(slots) || Object.keys(slots).length === 0) err('slots', 'boş olmayan nesne olmalı');
  else
    for (const [id, s] of Object.entries(slots)) {
      const p = `slots.${id}`;
      if (!isObj(s)) {
        err(p, 'nesne olmalı');
        continue;
      }
      if (!Array.isArray(s.options) || s.options.length === 0 || !s.options.every(isStr)) {
        err(`${p}.options`, 'boş olmayan metin dizisi olmalı');
        continue;
      }
      if (new Set(s.options).size !== s.options.length)
        err(`${p}.options`, 'tekrar eden seçenek var');
      if (!isStr(s.default) || !s.options.includes(s.default))
        err(`${p}.default`, `"${String(s.default)}" options içinde yok`);
      if (!isStr(s.camera) || !camIds.has(s.camera))
        err(`${p}.camera`, `"${String(s.camera)}" cameraPresets içinde tanımlı değil`);
    }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: input as CarManifest };
}

export type { CameraPreset, SlotDefinition };
